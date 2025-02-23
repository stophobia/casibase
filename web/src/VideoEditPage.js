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

import React from "react";
import {Affix, Avatar, Button, Card, Col, Input, Row, Segmented, Select, Tag, Timeline, Tooltip} from "antd";
import * as VideoBackend from "./backend/VideoBackend";
import * as Setting from "./Setting";
import i18next from "i18next";
import {LinkOutlined, SyncOutlined} from "@ant-design/icons";
import Video from "./Video";
import LabelTable from "./LabelTable";
import * as Papa from "papaparse";
import VideoDataChart from "./VideoDataChart";
import WordCloudChart from "./WordCloudChart";
import ChatPage from "./ChatPage";

const {Option} = Select;

class VideoEditPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      classes: props,
      videoName: props.match.params.videoName,
      video: null,
      player: null,
      screen: null,
      videoObj: null,
      ChatPageObj: null,
      videoData: null,
    };

    this.labelTable = React.createRef();
  }

  UNSAFE_componentWillMount() {
    this.getVideo();
  }

  getVideo() {
    VideoBackend.getVideo(this.props.account.name, this.state.videoName)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({
            video: res.data,
            currentTime: 0,
          });

          if (res.data.dataUrl !== "") {
            this.getDataAndParse(res.data.dataUrl);
          }
        } else {
          Setting.showMessage("error", `Failed to get video: ${res.msg}`);
        }
      });
  }

  parseVideoField(key, value) {
    if (["score"].includes(key)) {
      value = Setting.myParseInt(value);
    }
    return value;
  }

  updateVideoField(key, value) {
    value = this.parseVideoField(key, value);

    const video = this.state.video;
    video[key] = value;
    this.setState({
      video: video,
    });
  }

  onPause() {
    if (this.state.video.editMode === "Labeling" && this.state.video.tagOnPause) {
      this.labelTable.current.addRow(this.state.video.labels);
    }
  }

  renderVideoContent() {
    if (this.state.video.videoId === "") {
      return null;
    }

    const task = {};
    task.video = {
      vid: this.state.video.videoId,
      playAuth: this.state.video.playAuth,
      cover: this.state.video.coverUrl,
      videoWidth: 1920,
      videoHeight: 1080,
      width: "100%",
      autoplay: false,
      isLive: false,
      rePlay: false,
      playsinline: true,
      preload: true,
      controlBarVisibility: "hover",
      useH5Prism: true,
    };

    return (
      <div style={{marginTop: "10px"}}>
        <div style={{fontSize: 16, marginTop: "10px", marginBottom: "10px"}}>
          {i18next.t("video:Current time (second)")}: {" "}
          <Tag color={"processing"}>
            {this.state.currentTime}
          </Tag>
        </div>
        <div className="screen" style={{position: "absolute", zIndex: 100, pointerEvents: "none", width: "440px", height: "472px", marginLeft: "200px", marginRight: "200px", backgroundColor: "rgba(255,0,0,0)"}}></div>
        <Video task={task} labels={this.state.video.labels}
          onUpdateTime={(time) => {this.setState({currentTime: time});}}
          onCreatePlayer={(player) => {this.setState({player: player});}}
          onCreateScreen={(screen) => {this.setState({screen: screen});}}
          onCreateVideo={(videoObj) => {this.setState({videoObj: videoObj});}}
          onPause={() => {this.onPause();}}
        />
      </div>
    );
  }

  getDataAndParse(dataUrl) {
    fetch(dataUrl, {
      method: "GET",
    }).then(res => res.text())
      .then(res => {
        const result = Papa.parse(res, {header: true});
        let data = result.data;
        data = data.filter(item => item.time !== "");
        data = data.map(item => {
          const res = {};
          res.time = Number(item.time) - 5;
          res.data = Number(item.data);
          return res;
        });
        this.setState({
          videoData: data,
        });
      });
  }

  renderDataContent() {
    return (
      <React.Fragment>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("general:Data")}:
          </Col>
          <Col span={22} >
            <Select virtual={false} style={{width: "100%", marginBottom: "10px"}} value={this.state.video.dataUrl} onChange={(value => {
              this.getDataAndParse(value);
              this.updateVideoField("dataUrl", value);
            })}>
              {
                this.state.video.dataUrls?.map((dataUrl, index) => <Option key={index} value={dataUrl}>{dataUrl.split("/").pop()}</Option>)
              }
            </Select>
          </Col>
        </Row>
        {
          this.state.videoData === null ? null : (
            <React.Fragment>
              <VideoDataChart key={"VideoDataChart1"} data={this.state.videoData} currentTime={this.state.currentTime} height={"100px"} />
              <VideoDataChart key={"VideoDataChart2"} data={this.state.videoData} currentTime={this.state.currentTime} interval={25} />
            </React.Fragment>
          )
        }
      </React.Fragment>
    );
  }

  isSegmentActive(segment) {
    return this.state.currentTime >= segment.startTime && this.state.currentTime < segment.endTime;
  }

  isSegmentsDisabled() {
    if (this.state.video.segments === null || this.state.video.segments.length === 0) {
      return true;
    }
    return false;
  }

  renderSegments() {
    if (this.isSegmentsDisabled()) {
      return null;
    }

    return (
      <div style={{marginTop: "20px", marginBottom: "20px"}}>
        <Card size="small" title="Text">
          <Timeline style={{marginTop: "10px", marginLeft: "10px"}}
            items={
              this.state.video.segments.map((segment, index) => {
                return (
                  {
                    color: this.isSegmentActive(segment) ? "blue" : "gray",
                    dot: this.isSegmentActive(segment) ? <SyncOutlined spin /> : null,
                    children: (
                      <div style={{marginTop: "-10px", cursor: "pointer"}} onClick={() => {
                        this.setState({
                          currentTime: segment.startTime,
                        });

                        if (this.state.videoObj) {
                          this.state.videoObj.changeTime(segment.startTime);
                        }
                      }}>
                        <div style={{display: "inline-block", width: "75px", fontWeight: this.isSegmentActive(segment) ? "bold" : "normal"}}>{Setting.getTimeFromSeconds(segment.startTime)}</div>
                        &nbsp;&nbsp;
                        <Tag color={segment.speaker === "Teacher" ? "success" : segment.speaker.startsWith("Student") ? "error" : "processing"}>
                          {segment.speaker}
                        </Tag>
                        <Tag style={{fontSize: "medium", fontWeight: this.isSegmentActive(segment) ? "bold" : "normal", marginTop: "10px", lineHeight: "30px", whiteSpace: "normal", overflow: "visible"}} color={this.isSegmentActive(segment) ? "rgb(87,52,211)" : ""}>
                          {segment.text}
                        </Tag>
                      </div>
                    ),
                  }
                );
              })
            }
          />
        </Card>
      </div>
    );
  }

  isWordsDisabled() {
    if (this.state.video.wordCountMap === null || this.state.video.wordCountMap.length === 0) {
      return true;
    }
    return false;
  }

  renderWords() {
    if (this.isWordsDisabled()) {
      return null;
    }

    return (
      <WordCloudChart wordCountMap={this.state.video.wordCountMap} />
    );
  }

  generatePlan() {
    let text = this.state.video.template;
    text = text.replaceAll("${stage}", this.state.video.stage);
    text = text.replaceAll("${grade}", this.state.video.grade);
    text = text.replaceAll("${subject}", this.state.video.subject);
    text = text.replaceAll("${topic}", this.state.video.topic);
    text = text.replaceAll("${keywords}", this.state.video.keywords);
    // Setting.showMessage("success", text);
    this.state.chatPageObj.sendMessage(text, true);
  }

  renderAiAssistantOptions() {
    return (
      <React.Fragment>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:School")}:
          </Col>
          <Col span={3} >
            <Input value={this.state.video.school} onChange={e => {
              this.updateVideoField("school", e.target.value);
            }} />
          </Col>
          <Col span={1} />
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Stage")}:
          </Col>
          <Col span={3} >
            <Input value={this.state.video.stage} onChange={e => {
              this.updateVideoField("stage", e.target.value);
            }} />
          </Col>
          <Col span={1} />
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Grade")}:
          </Col>
          <Col span={3} >
            <Input value={this.state.video.grade} onChange={e => {
              this.updateVideoField("grade", e.target.value);
            }} />
          </Col>
          <Col span={1} />
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Class")}:
          </Col>
          <Col span={3} >
            <Input value={this.state.video.class} onChange={e => {
              this.updateVideoField("class", e.target.value);
            }} />
          </Col>
        </Row>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Keywords")}:
          </Col>
          <Col span={22} >
            <Select virtual={false} mode="tags" style={{width: "100%"}} value={this.state.video.keywords} onChange={(value => {this.updateVideoField("keywords", value);})}>
              {
                this.state.video.keywords?.map((item, index) => <Option key={index} value={item}>{item}</Option>)
              }
            </Select>
          </Col>
        </Row>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Subject")}:
          </Col>
          <Col span={3} >
            <Input value={this.state.video.subject} onChange={e => {
              this.updateVideoField("subject", e.target.value);
            }} />
          </Col>
          <Col span={1} />
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Topic")}:
          </Col>
          <Col span={3} >
            <Input value={this.state.video.topic} onChange={e => {
              this.updateVideoField("topic", e.target.value);
            }} />
          </Col>
          <Col span={1} />
          <Col span={3} >
            <Button style={{marginLeft: "20px"}} type="primary" onClick={() => this.generatePlan()}>{i18next.t("video:Generate Plan")}</Button>
          </Col>
          <Col span={1} />
          <Col span={3} >
            <Tooltip placement="top" trigger={"click"} title={
              <Input value={this.state.video.template} onChange={e => {
                this.updateVideoField("template", e.target.value);
              }} />
            }>
              <Button style={{marginLeft: "20px"}}>{i18next.t("video:Edit Template")}</Button>
            </Tooltip>
          </Col>
        </Row>
      </React.Fragment>
    );
  }

  renderChat() {
    return (
      <div style={{marginTop: "20px"}}>
        {
          this.renderAiAssistantOptions()
        }
        <div style={{marginTop: "20px"}}>
          <ChatPage onCreateChatPage={(chatPageObj) => {this.setState({chatPageObj: chatPageObj});}} account={this.props.account} />
        </div>
      </div>
    );
  }

  renderLabels() {
    return (
      <div style={{marginTop: "20px"}}>
        <LabelTable
          ref={this.labelTable}
          title={i18next.t("video:Labels")}
          table={this.state.video.labels}
          currentTime={this.state.currentTime}
          video={this.state.video}
          player={this.state.player}
          screen={this.state.screen}
          videoObj={this.state.videoObj}
          onUpdateTable={(value) => {this.updateVideoField("labels", value);}}
          onUpdateTagOnPause={(value) => {this.updateVideoField("tagOnPause", value);}}
        />
      </div>
    );
  }

  renderVideo() {
    return (
      <Card size="small" title={
        <div>
          {i18next.t("video:Edit Video")}&nbsp;&nbsp;&nbsp;&nbsp;
          <Button onClick={() => this.submitVideoEdit(false)}>{i18next.t("general:Save")}</Button>
          <Button style={{marginLeft: "20px"}} type="primary" onClick={() => this.submitVideoEdit(true)}>{i18next.t("general:Save & Exit")}</Button>
        </div>
      } style={{marginLeft: "5px"}} type="inner">
        <Row style={{marginTop: "10px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("general:Name")}:
          </Col>
          <Col span={5} >
            <Input value={this.state.video.name} onChange={e => {
              this.updateVideoField("name", e.target.value);
            }} />
          </Col>
          <Col span={1} />
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("general:Display name")}:
          </Col>
          <Col span={5} >
            <Input value={this.state.video.displayName} onChange={e => {
              this.updateVideoField("displayName", e.target.value);
            }} />
          </Col>
          <Col span={1} />
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Tag")}:
          </Col>
          <Col span={5} >
            <Input value={this.state.video.tag} onChange={e => {
              this.updateVideoField("tag", e.target.value);
            }} />
          </Col>
        </Row>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Audio URL")}:
          </Col>
          <Col span={9} >
            <Input value={this.state.video.audioUrl} onChange={e => {
              this.updateVideoField("audioUrl", e.target.value);
            }} />
          </Col>
          <Col span={1} />
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Video ID")}:
          </Col>
          <Col span={9} >
            <Input disabled={true} value={this.state.video.videoId} onChange={e => {
              this.updateVideoField("videoId", e.target.value);
            }} />
          </Col>
        </Row>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {i18next.t("video:Cover")}:
          </Col>
          <Col span={22} style={(Setting.isMobile()) ? {maxWidth: "100%"} : {}}>
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 1}>
                {i18next.t("general:URL")}:
              </Col>
              <Col span={23} >
                <Input disabled={true} prefix={<LinkOutlined />} value={this.state.video.coverUrl} onChange={e => {
                  this.updateVideoField("coverUrl", e.target.value);
                }} />
              </Col>
            </Row>
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 1}>
                {i18next.t("general:Preview")}:
              </Col>
              <Col span={23} >
                <a target="_blank" rel="noreferrer" href={this.state.video.coverUrl}>
                  <img src={this.state.video.coverUrl} alt={this.state.video.coverUrl} height={90} style={{marginBottom: "20px"}} />
                </a>
              </Col>
            </Row>
          </Col>
        </Row>
        <Segmented
          options={[
            {
              label: (
                <div style={{padding: 4}}>
                  <Avatar src={"https://cdn.casbin.org/img/email_mailtrap.png"} />
                  &nbsp;
                  <span style={{fontWeight: "bold"}}>Labeling</span>
                </div>
              ),
              value: "Labeling",
            },
            {
              label: (
                <div style={{padding: 4}}>
                  <Avatar src={"https://cdn.casbin.org/img/social_slack.png"} />
                  &nbsp;
                  <span style={{fontWeight: "bold"}}>Text Recognition</span>
                </div>
              ),
              value: "Text Recognition",
              disabled: this.isSegmentsDisabled(),
            },
            {
              label: (
                <div style={{padding: 4}}>
                  <Avatar src={"https://cdn.casbin.org/img/social_cloudflare.png"} />
                  &nbsp;
                  <span style={{fontWeight: "bold"}}>Word Cloud</span>
                </div>
              ),
              value: "Word Cloud",
              disabled: this.isWordsDisabled(),
            },
            {
              label: (
                <div style={{padding: 4}}>
                  <Avatar src={"https://cdn.casbin.org/img/social_openai.svg"} />
                  &nbsp;
                  <span style={{fontWeight: "bold"}}>AI Assistant</span>
                </div>
              ),
              value: "AI Assistant",
            },
          ]}
          block value={this.state.video.editMode} onChange={checked => {
            this.updateVideoField("editMode", checked);
          }}
        />
        <Row style={{marginTop: "20px"}} >
          {
            this.state.video.editMode === "AI Assistant" ? null : (
              <React.Fragment>
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {i18next.t("video:Video")}:
                </Col>
                <Col span={9} style={(Setting.isMobile()) ? {maxWidth: "100%"} : {}}>
                  <React.Fragment>
                    <Affix offsetTop={50}>
                      {
                        this.state.video !== null ? this.renderVideoContent() : null
                      }
                      {
                        this.state.video.dataUrl !== "" ? this.renderDataContent() : null
                      }
                    </Affix>
                  </React.Fragment>
                </Col>
                <Col span={1}>
                </Col>
              </React.Fragment>
            )
          }
          <Col span={this.state.video.editMode !== "AI Assistant" ? 12 : 24} >
            {
              this.state.video.editMode === "Labeling" ? this.renderLabels() :
                this.state.video.editMode === "Text Recognition" ? this.renderSegments() :
                  this.state.video.editMode === "Word Cloud" ? this.renderWords() :
                    this.renderChat()
            }
          </Col>
        </Row>
      </Card>
    );
  }

  submitVideoEdit(exitAfterSave) {
    const video = Setting.deepCopy(this.state.video);
    VideoBackend.updateVideo(this.state.video.owner, this.state.videoName, video)
      .then((res) => {
        if (res.status === "ok") {
          if (res.data) {
            Setting.showMessage("success", "Successfully saved");
            this.setState({
              videoName: this.state.video.name,
            });
            if (exitAfterSave) {
              this.props.history.push("/videos");
            } else {
              this.props.history.push(`/videos/${this.state.video.name}`);
            }
          } else {
            Setting.showMessage("error", "failed to save: server side failure");
            this.updateVideoField("name", this.state.videoName);
          }
        } else {
          Setting.showMessage("error", `failed to save: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `failed to save: ${error}`);
      });
  }

  render() {
    return (
      <div>
        {
          this.state.video !== null ? this.renderVideo() : null
        }
        <div style={{marginTop: "20px", marginLeft: "40px"}}>
          <Button size="large" onClick={() => this.submitVideoEdit(false)}>{i18next.t("general:Save")}</Button>
          <Button style={{marginLeft: "20px"}} type="primary" size="large" onClick={() => this.submitVideoEdit(true)}>{i18next.t("general:Save & Exit")}</Button>
        </div>
      </div>
    );
  }
}

export default VideoEditPage;
