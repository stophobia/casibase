// Copyright 2023 The casbin Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package controllers

import (
	_ "embed"
	"fmt"

	"github.com/astaxie/beego"
	"github.com/casdoor/casdoor-go-sdk/casdoorsdk"
	"github.com/casibase/casibase/object"
	"github.com/casibase/casibase/util"
)

//go:embed token_jwt_key.pem
var JwtPublicKey string

func init() {
	InitAuthConfig()
}

func InitAuthConfig() {
	casdoorEndpoint := beego.AppConfig.String("casdoorEndpoint")
	clientId := beego.AppConfig.String("clientId")
	clientSecret := beego.AppConfig.String("clientSecret")
	casdoorOrganization := beego.AppConfig.String("casdoorOrganization")
	casdoorApplication := beego.AppConfig.String("casdoorApplication")

	casdoorsdk.InitConfig(casdoorEndpoint, clientId, clientSecret, JwtPublicKey, casdoorOrganization, casdoorApplication)
}

func (c *ApiController) Signin() {
	code := c.Input().Get("code")
	state := c.Input().Get("state")

	token, err := casdoorsdk.GetOAuthToken(code, state)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	claims, err := casdoorsdk.ParseJwtToken(token.AccessToken)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if !claims.IsAdmin {
		claims.Type = "chat-user"
	}

	err = c.addInitialChat(&claims.User)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	claims.AccessToken = token.AccessToken
	c.SetSessionClaims(claims)

	c.ResponseOk(claims)
}

func (c *ApiController) Signout() {
	c.SetSessionClaims(nil)

	c.ResponseOk()
}

func (c *ApiController) addInitialChat(user *casdoorsdk.User) error {
	chats, err := object.GetChatsByUser("admin", user.Name)
	if err != nil {
		return err
	}

	if len(chats) != 0 {
		return nil
	}

	store, err := object.GetDefaultStore("admin")
	if err != nil {
		return err
	}
	if store == nil {
		return fmt.Errorf("The default store is not found")
	}

	randomName := util.GetRandomName()
	chat := object.Chat{
		Owner:        "admin",
		Name:         fmt.Sprintf("chat_%s", randomName),
		CreatedTime:  util.GetCurrentTime(),
		UpdatedTime:  util.GetCurrentTime(),
		DisplayName:  fmt.Sprintf("New Chat - %d", 1),
		Store:        store.GetId(),
		Category:     "Default Category",
		Type:         "AI",
		User:         user.Name,
		User1:        fmt.Sprintf("%s/%s", user.Owner, user.Name),
		User2:        "",
		Users:        []string{fmt.Sprintf("%s/%s", user.Owner, user.Name)},
		ClientIp:     c.getClientIp(),
		UserAgent:    c.getUserAgent(),
		MessageCount: 0,
	}

	chat.ClientIpDesc = util.GetDescFromIP(chat.ClientIp)
	chat.UserAgentDesc = util.GetDescFromUserAgent(chat.UserAgent)

	_, err = object.AddChat(&chat)
	if err != nil {
		return err
	}

	randomName = util.GetRandomName()
	answerMessage := &object.Message{
		Owner:       "admin",
		Name:        fmt.Sprintf("message_%s", util.GetRandomName()),
		CreatedTime: util.GetCurrentTimeEx(chat.CreatedTime),
		// Organization: message.Organization,
		User:         user.Name,
		Chat:         chat.Name,
		ReplyTo:      "Welcome",
		Author:       "AI",
		Text:         "",
		VectorScores: []object.VectorScore{},
	}
	_, err = object.AddMessage(answerMessage)
	return err
}

func (c *ApiController) anonymousSignin() {
	clientIp := c.getClientIp()
	userAgent := c.getUserAgent()
	hash := getContentHash(fmt.Sprintf("%s|%s", clientIp, userAgent))
	username := fmt.Sprintf("u-%s", hash)

	casdoorOrganization := beego.AppConfig.String("casdoorOrganization")
	user := casdoorsdk.User{
		Owner:           casdoorOrganization,
		Name:            username,
		CreatedTime:     util.GetCurrentTime(),
		Id:              username,
		Type:            "anonymous-user",
		DisplayName:     "User",
		Avatar:          "https://cdn.casdoor.com/casdoor/resource/built-in/admin/casibase-user.png",
		AvatarType:      "",
		PermanentAvatar: "",
		Email:           "",
		EmailVerified:   false,
		Phone:           "",
		CountryCode:     "",
		Region:          "",
		Location:        "",
		Education:       "",
		IsAdmin:         false,
		CreatedIp:       "",
	}

	err := c.addInitialChat(&user)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(user)
}

func (c *ApiController) GetAccount() {
	configPublicDomain := beego.AppConfig.String("publicDomain")
	if configPublicDomain == "" || c.Ctx.Request.Host != configPublicDomain {
		_, ok := c.RequireSignedIn()
		if !ok {
			return
		}
	} else {
		_, ok := c.CheckSignedIn()
		if !ok {
			c.anonymousSignin()
			return
		}
	}

	claims := c.GetSessionClaims()

	c.ResponseOk(claims)
}
