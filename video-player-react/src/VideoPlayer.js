import React from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import AnnotationComments from "@contently/videojs-annotation-comments";
import "videojs-markers";
import "videojs-hotkeys";
import "videojs-markers/dist/videojs.markers.css";
import { renderToString } from "react-dom/server";
import { Row, Col } from "react-bootstrap";
import ReactTooltip from "react-tooltip";
import JSZip from "jszip";
import FileSaver from "file-saver";
import {
  Select,
  Slider,
  MenuItem,
  Dialog,
  DialogTitle,
  Tooltip,
  duration,
  Button,
} from "@material-ui/core";
import csvData from "../assets/Sample_labeling_scheme.csv";
import { Table } from "react-bootstrap";
import $ from "jquery";
import "jquery-ui-bundle";

function float2int(value) {
  return value | 0;
}
function hashCode(s) {
  return s.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
}
function getFormattedDate(date) {
  let year = date.getFullYear();
  let month = (1 + date.getMonth()).toString().padStart(2, "0");
  let day = date.getDate().toString().padStart(2, "0");

  return day + "-" + month + "-" + year;
}
function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function getRandomColor() {
  var letters = "0123456789ABCDEF";
  var color = "#";
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

function convertSecondsToDateFormat(totalSeconds) {
  let hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = float2int(totalSeconds % 60);

  // If you want strings with leading zeroes:
  minutes = String(minutes).padStart(2, "0");
  hours = String(hours).padStart(2, "0");
  seconds = String(seconds).padStart(2, "0");
  var result = hours + ":" + minutes + ":" + seconds;
  return result;
}

export default class VideoPlayer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      videoCreatedDate: null,
      annotationIdColorMap: null,
      progressPercentage: "",
      player: null,
      categoryChoicesDialog: false,
      openLabelledData: false,
      advPlayerObj: null,
      videoFileURL: "",
      videoFileType: "",
      videoSpeed: 1,
      currentSkipSeconds: 10,
      skipSeconds: 10,
      rangeValues: [],
      zoomInMarkerGapPercent: 5,
      colorDict: null,
      label: {
        mode: false,
        startTime: null,
      },
      videoHash: "",
      currentLabelledData: null,
      labellingCategoryChoices: [],
      zoomedInAnnotationList: [],
      currentTimeLabel: null,
      currentTimeLabelColor: null,
    };
    this.importVideo = React.createRef();
    this.importLabel = React.createRef();
    this.handleReceivedText = this.handleReceivedText.bind(this);
  }
  moveZoomInMarkers(leftMarker, rightMarker) {
    var values = [leftMarker, rightMarker];

    var markers = this.player.markers.getMarkers();
    var prevIndexLeft = markers.findIndex(
      (v) => v.time == this.state.rangeValues[0]
    );
    var prevIndexRight = markers.findIndex(
      (v) => v.time == this.state.rangeValues[1]
    );
    this.player.markers.remove([prevIndexLeft, prevIndexRight]);
    this.player.markers.add([
      {
        time: values[0],
        text: values[0],
        class: "zoom-range",
      },
      {
        time: values[1],
        text: values[1],
        class: "zoom-range",
      },
    ]);

    for (var i = 0; i < values.length; i++) {
      var icon = i == 0 ? "[" : "]";
      $(".vjs-marker[data-marker-time='" + values[i] + "']").html(icon);
    }
    this.drawZoomedInLabels(
      values[0],
      values[1],
      this.annotationPlugin.annotationState.data,
      this.state.annotationIdColorMap
    );
    this.adjustCustomSeekBarProgress(values[0], values[1]);
    this.setState({
      rangeValues: values,
    });
  }
  draggableEventListenersMarkers() {
    var self = this;
    var draggableMarkersSelector =
      ".vjs-marker:not(.black-pixel, .start-label)";
    $("body").on("mouseover", draggableMarkersSelector, function () {
      // disable on click on progress bar
      self.state.player.controlBar.progressControl.disable();
    });
    $("body")
      .on("mousedown", draggableMarkersSelector, function (e) {
        // console.log("mouse down");

        $(e.target).draggable({
          axis: "x",
          containment: ".vjs-progress-holder",
          drag: function (e, ui) {
            var html = $(e.target).html();
            var leftSize = $(e.target)[0].style.left.replace(/[^-\d\.]/g, "");
            var parentWidth = $(".vjs-progress-holder").width();
            if (html == "[") {
              var selector =
                ".vjs-marker:not(.black-pixel, .start-label):eq(1)";

              const outPosition = parseInt($(selector).css("left"));
              if (ui.position.left >= outPosition) {
                ui.position.left = outPosition - 10;
              }
            } else {
              const inPosition = parseInt(
                $(`.vjs-slider ${draggableMarkersSelector}:eq(0)`).css("left")
              );
              if (ui.position.left <= inPosition) {
                ui.position.left = inPosition + 10;
              }
            }

            var values = [];
            var leftPercentage = (leftSize / parentWidth) * 100;
            var totalDuration = self.state.player.duration();
            if (leftSize == 578) leftPercentage = 100;
            var noOfSecondsFromLeft = (leftPercentage / 100) * totalDuration;
            if (html == "[") {
              //dragging left braces
              values[0] = noOfSecondsFromLeft;
              values[1] = self.state.rangeValues[1];
            } else {
              //dragging right braces
              values[0] = self.state.rangeValues[0];
              values[1] = noOfSecondsFromLeft;
            }
            self.moveZoomInMarkers(values[0], values[1]);
          },
        });
      })
      .on("mouseup", function (event) {
        var markerList = $(draggableMarkersSelector);
        if (markerList.length > 0) {
          $(markerList).each(function (index) {
            // console.log(index + ": " + $(this).text());
            $(this).draggable();
          });
        }
        self.state.player != null &&
          self.state.player.controlBar.progressControl.enable();
      });
  }
  componentDidMount() {
    //register plugin
    videojs.registerPlugin("annotationComments", AnnotationComments(videojs));
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.zoomedInAnnotationList !== prevState.zoomedInAnnotationList
    ) {
      console.log(
        this.state.zoomedInAnnotationList,
        prevState.zoomedInAnnotationList
      );
      ReactTooltip.rebuild();
    }
  }
  // destroy player on unmount
  componentWillUnmount() {
    console.log("unmount");
    if (this.player) {
      this.player.dispose();
    }
  }
  drawZoomedInLabels(
    rangeStartTime,
    rangeEndTime,
    annotationsList,
    annotationIdColorMap
  ) {
    var rangeDuration = rangeEndTime - rangeStartTime;
    var zoomedInAnnotationList = [];
    for (var i = 0; i < annotationsList.length; i++) {
      var data = annotationsList[i];
      var color = annotationIdColorMap[data.id];
      var annotationStartTime = data.range.start;
      var annotationEndTime = data.range.end;
      if (
        annotationStartTime >= rangeStartTime &&
        annotationEndTime <= rangeEndTime
      ) {
        //in between
        var rangePercentage = {
          start: ((annotationStartTime - rangeStartTime) / rangeDuration) * 100,
          end: ((annotationEndTime - rangeStartTime) / rangeDuration) * 100,
        };
        var annotationObj = {
          id: data.id,
          range: data.range,
          comments: data.comments,
          rangePercentage: rangePercentage,
          color: color,
          active: false,
        };
        zoomedInAnnotationList.push(annotationObj);
      }
      if (
        annotationStartTime < rangeStartTime &&
        annotationEndTime <= rangeEndTime &&
        annotationEndTime > rangeStartTime
      ) {
        //left extended
        var rangePercentage = {
          start: 0,
          end: ((annotationEndTime - rangeStartTime) / rangeDuration) * 100,
        };
        var annotationObj = {
          id: data.id,
          range: data.range,
          comments: data.comments,
          rangePercentage: rangePercentage,
          color: color,
          active: false,
        };
        zoomedInAnnotationList.push(annotationObj);
      }
      if (
        annotationStartTime >= rangeStartTime &&
        annotationEndTime > rangeEndTime &&
        annotationStartTime < rangeEndTime
      ) {
        //right extended
        var rangePercentage = {
          start: ((annotationStartTime - rangeStartTime) / rangeDuration) * 100,
          end: 100,
        };
        var annotationObj = {
          id: data.id,
          range: data.range,
          comments: data.comments,
          rangePercentage: rangePercentage,
          color: color,
          active: false,
        };
        zoomedInAnnotationList.push(annotationObj);
      }
      if (
        annotationStartTime < rangeStartTime &&
        annotationEndTime > rangeEndTime
      ) {
        //both sides extended
        var rangePercentage = {
          start: 0,
          end: 100,
        };
        var annotationObj = {
          id: data.id,
          range: data.range,
          comments: data.comments,
          rangePercentage: rangePercentage,
          color: color,
          active: false,
        };
        zoomedInAnnotationList.push(annotationObj);
      }
    }
    this.setState({
      zoomedInAnnotationList: zoomedInAnnotationList,
    });
  }
  handleImportLabel(e) {
    let files = e.target.files;
    if (files.length === 1) {
      let file = files[0];
      var fr = new FileReader();
      fr.onload = this.handleReceivedText;
      fr.readAsText(file);
    }
  }

  handleReceivedText(e) {
    let lines = e.target.result;
    var jsonAnnotations = JSON.parse(lines);
    if (jsonAnnotations["videoHash"] !== this.state.videoHash) {
      alert("Incorrect label imported!");
      return;
    }
    this.annotationPlugin.dispose();
    this.removeMarkersByClassName("black-pixel");
    const { labellingCategoryChoices, colorDict } = this.state;
    var annotationIdColorMap = {};
    for (var annotation of jsonAnnotations["annotations"]) {
      var guid = annotation["id"];
      var jsonComment = JSON.parse(annotation["comments"][0]["body"]);
      var selectedColor = this.getColor(jsonComment, colorDict);
      annotationIdColorMap[guid] = selectedColor;
    }

    this.loadAnnotationPlugin(
      jsonAnnotations["annotations"],
      labellingCategoryChoices,
      colorDict,
      annotationIdColorMap
    );
    this.drawZoomedInLabels(
      this.state.rangeValues[0],
      this.state.rangeValues[1],
      this.annotationPlugin.options.annotationsObjects,
      annotationIdColorMap
    );
    this.updateLabelsDefaultTimelineAfterDOMLoad(
      this.annotationPlugin.options.annotationsObjects
    );
    alert("Labels successfully imported!!");
  }
  handleVideoLoad(e) {
    // if (this.player) this.player.dispose();
    // if (this.advVideoPlayer) this.advVideoPlayer.dispose();
    let files = e.target.files;
    var self = this;
    if (files.length === 1) {
      let file = files[0];
      var date = file.lastModifiedDate;
      var convertedDate = getFormattedDate(date);
      console.log(convertedDate);
      var hash = hashCode(file.size.toString());
      console.log(file.size, hash);
      var videoFileURL = URL.createObjectURL(file);
      var videoFileType = file.type;
      self.renderVideoPlayer(videoFileURL, videoFileType, hash, convertedDate);
      //make videojs marker draggable event listeners
      self.draggableEventListenersMarkers();
    }
  }

  getLabellingDataFromCSV() {
    var csvArray = [];
    for (var key in csvData[0]) {
      var obj = {
        variable: key,
        values: [],
        selectedValue: "",
      };
      csvArray.push(obj);
    }

    for (var key in csvData) {
      var value = csvData[key];
      for (var i in value) {
        var csvArrayVariableData = csvArray.find((c) => c.variable == i);
        if (value[i]) csvArrayVariableData.values.push(value[i]);
      }
    }
    //populate selectedValue field
    csvArray.forEach((variable) => {
      variable.selectedValue = variable.values[0];
    });

    this.setState({
      labellingCategoryChoices: csvArray,
    });
    return csvArray;
  }
  adjustCustomSeekBarProgress(sliderStartTime, sliderEndTime) {
    var player = this.state.player;
    var progress = 0;
    if (player.currentTime() < sliderStartTime) {
      this.setState({
        progressPercentage: progress,
      });
    } else if (player.currentTime() > sliderEndTime) {
      progress = 100;
      this.setState({
        progressPercentage: progress,
      });
    } else {
      var currentTimeRelativeToSliderStartTime =
        player.currentTime() - sliderStartTime;
      var durationRelativeToSliderTimes = sliderEndTime - sliderStartTime;
      var percentage =
        (currentTimeRelativeToSliderStartTime / durationRelativeToSliderTimes) *
        100;
      progress = percentage;
      this.setState({
        progressPercentage: progress,
      });
    }
    this.markActiveLabel(progress);
  }

  markActiveLabel(progressPercentage) {
    var annotationList = this.state.zoomedInAnnotationList;
    for (var i = 0; i < annotationList.length; i++) {
      var annotationObj = annotationList[i];

      if (
        progressPercentage >= annotationObj.rangePercentage.start &&
        progressPercentage <= annotationObj.rangePercentage.end &&
        progressPercentage > 0 &&
        progressPercentage < 100
      ) {
        annotationObj.active = true;
      } else {
        annotationObj.active = false;
      }
    }
    this.setState({
      zoomedInAnnotationList: annotationList,
    });
  }
  markPlayer() {
    var inTimeOutTimeList = this.state.rangeValues;
    for (var i = 0; i < inTimeOutTimeList.length; i++) {
      this.player.markers.add([
        {
          time: inTimeOutTimeList[i],
          text: inTimeOutTimeList[i],
          class: "zoom-range",
        },
      ]);

      var icon = i == 0 ? "[" : "]";
      var marker = $(
        ".vjs-marker[data-marker-time='" + inTimeOutTimeList[i] + "']"
      );
      marker.draggable();
      marker.html(icon);
    }
  }

  getRandomPATypes(categoryChoices) {
    var selectedList = [];
    for (var variableKey in categoryChoices) {
      var obj = categoryChoices[variableKey];
      if (obj.variable == "POSTURE") {
        selectedList.push({
          category: obj.variable,
          selectedValue:
            obj.values[Math.floor(Math.random() * obj.values.length)],
        });
      } else {
        selectedList.push({
          category: obj.variable,
          selectedValue: obj.selectedValue,
        });
      }
    }
    return selectedList;
  }

  getColor(jsonComment, colorDict) {
    var postureObj = jsonComment.find((v) => v["category"] == "POSTURE");
    var selectedValuePosture = postureObj["selectedValue"];
    var selectedColor = colorDict[selectedValuePosture];
    return selectedColor;
  }
  populateAnnotations(categoryChoices, colorDict, annotationIdColorMap) {
    var annotations = [];
    var start = 0;
    var totalDuration = this.player.duration();
    while (start <= totalDuration) {
      var randomInt = randomIntFromInterval(50, 100);
      var end = start + randomInt;
      if (end > totalDuration) {
        break;
      }
      var jsonComment = this.getRandomPATypes(categoryChoices);
      var stringCommentBody = JSON.stringify(jsonComment);
      var selectedColor = this.getColor(jsonComment, colorDict);
      var guid = uuidv4();
      annotationIdColorMap[guid] = selectedColor;
      var obj = {
        id: guid,
        range: {
          start: start,
          end: end,
        },
        shape: {
          x1: null,
          y1: null,
          x2: null,
          y2: null,
        },
        comments: [
          {
            id: 1,
            meta: {
              datetime: "2017-03-28T19:17:32.238Z",
              user_id: 1,
              user_name: "Jack Pope",
            },
            body: stringCommentBody,
          },
        ],
      };

      annotations.push(obj);
      start = start + randomInt;
    }
    return annotations;
  }
  onAnnotationRegionStateChange() {
    // onStateChanged: Fired when plugin state has changed (annotation added, removed, etc)
    // This is a way to watch global plugin state, as an alternative to watching various annotation events
    var self = this;
    this.annotationPlugin.registerListener("onStateChanged", (event) => {
      console.log("state change");
      this.updateLabelsDefaultTimelineAfterDOMLoad(
        self.annotationPlugin.annotationState.data
      );
    });
  }
  loadAnnotationPlugin(
    annotations,
    categoryChoices,
    colorDict,
    annotationIdColorMap
  ) {
    const annotationPluginOptions = {
      annotationsObjects: annotations,
      bindArrowKeys: false,
      meta: {
        user_id: 2,
        user_name: "Harish",
      },
      showControls: false,
      showCommentList: false,
      showFullScreen: true,
      startInAnnotationMode: true,
      showMarkerShapeAndTooltips: true,
    };
    this.annotationPlugin = this.player.annotationComments(
      annotationPluginOptions
    );

    //   this.onLabelledRegionMouseClick();
    this.onAnnotationRegionStateChange();

    this.setState({
      colorDict: colorDict,
      annotationIdColorMap: annotationIdColorMap,
    });
  }
  // removeCurrentBlackPixel(currentTime) {
  //   var markers = this.player.markers.getMarkers();
  //   var removeMarkersIds = [];
  //   var subsetMarkers = markers.filter(
  //     (v) => v.time <= currentTime && v.class == "black-pixel"
  //   );

  //   var index = markers.indexOf(
  //     (m) => m.key == subsetMarkers[subsetMarkers.length-1].key
  //   );
  //   removeMarkersIds.push(index);
  //   this.player.markers.remove(removeMarkersIds);
  // }

  removeMarkersByClassName(className) {
    var markers = this.player.markers.getMarkers();
    var removeMarkersIds = [];
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].class == className) {
        removeMarkersIds.push(i);
      }
    }
    this.player.markers.remove(removeMarkersIds);
  }
  colorLabelInDefaultTimeline(
    annotationElement,
    annotationIdColorMap,
    annotationsList,
    index
  ) {
    var annotation = annotationsList[index];
    var color = annotationIdColorMap[annotation.id];
    $(annotationElement).css("background-color", color);
  }
  resizableCustomProgressBar() {
    var self = this;
    var customprogressBarElement = $(".customprogress-bar");
    console.log(customprogressBarElement);
    $(customprogressBarElement).resizable({
      handles: "e",
      containment: "#custom-seekbar",
      resize: function (event, ui) {
        self.handleCustomSeekbarClick(event);
      },
    });
  }

  getPreviousLabel(time) {
    var annotationData = this.annotationPlugin.annotationState.data;
    var subsetAnnotationData = annotationData.filter(
      (v) => v.range.end <= time
    );
    if (subsetAnnotationData.length == 0 || !subsetAnnotationData) {
      return null;
    }
    return subsetAnnotationData[subsetAnnotationData.length - 1];
  }

  getCurrentLabel(time) {
    var annotationData = this.annotationPlugin.annotationState.data;
    var currentLabel = annotationData.find(
      (v) => time > v.range.start && time < v.range.end
    );
    if (currentLabel) return currentLabel;
    return null;
  }

  getNextLabelStartTime(currentTime, duration) {
    var annotationData = this.annotationPlugin.annotationState.data;
    var subsetAnnotationData = annotationData.filter(
      (v) => v.range.start >= currentTime
    );
    if (subsetAnnotationData.length == 0 || !subsetAnnotationData) {
      return duration;
    }
    return subsetAnnotationData[0].range.start;
  }

  getColorDict(categoryChoices) {
    var colorDict = {};
    var postureValues = categoryChoices[0]["values"];
    for (var i = 0; i < postureValues.length; i++) {
      var posture = postureValues[i];
      colorDict[posture] = getRandomColor();
    }
    return colorDict;
  }
  resetCurrentLabel(currentTime) {
    var annotationIdColorMap = this.state.annotationIdColorMap;
    var annotationData = this.annotationPlugin.annotationState.data;
    var currentLabel = annotationData.find(
      (v) => currentTime >= v.range.start && currentTime <= v.range.end
    );
    var currentLabelId = "";
    if (currentLabel === undefined) {
      // delete previous label
      var subsetAnnotationData = annotationData.filter(
        (v) => v.range.end <= currentTime
      );
      if (subsetAnnotationData.length == 0 || !subsetAnnotationData) {
        alert("No current labels present to delete!");
        return;
      }
      currentLabel = subsetAnnotationData[subsetAnnotationData.length - 1];
      currentLabelId = currentLabel.id;
      this.annotationPlugin.fire("destroyAnnotation", {
        id: currentLabelId,
      });
    } else {
      // delete current label
      currentLabelId = currentLabel.id;
      this.annotationPlugin.fire("destroyAnnotation", { id: currentLabelId });
    }
    // if (blackMarkerPixelAnnotationIds.includes(currentLabel.id)) {
    //   // deleting a black pixel marker
    //   this.removeCurrentBlackPixel(currentTime);
    // }
    delete annotationIdColorMap[currentLabelId];
    this.drawZoomedInLabels(
      this.state.rangeValues[0],
      this.state.rangeValues[1],
      this.annotationPlugin.annotationState.data,
      annotationIdColorMap
    );

    this.setState({
      annotationIdColorMap: annotationIdColorMap,
    });
  }
  resetToDefault() {
    this.annotationPlugin.dispose();
    this.removeMarkersByClassName("black-pixel");
    var categoryChoices = this.getLabellingDataFromCSV();
    var colorDict = this.getColorDict(categoryChoices);
    var annotationIdColorMap = {};
    this.loadAnnotationPlugin(
      [],
      categoryChoices,
      colorDict,
      annotationIdColorMap
    );
    this.drawZoomedInLabels(
      this.state.rangeValues[0],
      this.state.rangeValues[1],
      this.annotationPlugin.options.annotationsObjects,
      annotationIdColorMap
    );
  }
  createLabelFromExisting(labelStartTime, labelEndTime, currentLabel) {
    var guid = uuidv4();
    var annotationIdColorMap = this.state.annotationIdColorMap;
    var jsonComment = JSON.parse(currentLabel.comments[0].body);
    var selectedColor = this.getColor(jsonComment, this.state.colorDict);

    annotationIdColorMap[guid] = selectedColor;

    // newAnnotation : Adds a new annotation within the player and opens it given comment data
    this.annotationPlugin.fire("newAnnotation", {
      id: guid,
      range: { start: labelStartTime, end: labelEndTime },
      shape: {
        // NOTE - x/y vals are % based (Floats) in video, not pixel values
        x1: null,
        x2: null,
        y1: null,
        y2: null,
      },
      commentStr: JSON.stringify(jsonComment),
    });
  }
  createLabel(labelStartTime, labelEndTime) {
    var guid = uuidv4();
    var annotationIdColorMap = this.state.annotationIdColorMap;
    var jsonComment = this.getSelectedChoices(
      this.state.labellingCategoryChoices
    );
    var selectedColor = this.getColor(jsonComment, this.state.colorDict);

    annotationIdColorMap[guid] = selectedColor;

    // newAnnotation : Adds a new annotation within the player and opens it given comment data
    this.annotationPlugin.fire("newAnnotation", {
      id: guid,
      range: { start: labelStartTime, end: labelEndTime },
      shape: {
        // NOTE - x/y vals are % based (Floats) in video, not pixel values
        x1: null,
        x2: null,
        y1: null,
        y2: null,
      },
      commentStr: JSON.stringify(jsonComment),
    });
  }
  checkOverlappingLabel(currentTime) {
    var currentLabel = this.getCurrentLabel(currentTime);
    if (currentLabel) {
      return true;
    }
    return false;
  }

  checkStrictlyOverlappingLabel(labelStartTime, stopLabelledTime) {
    var annotationData = this.annotationPlugin.annotationState.data;
    var strictlyOverlappingLabel = annotationData.find(
      (v) =>
        labelStartTime > v.range.start &&
        labelStartTime < v.range.end &&
        stopLabelledTime > v.range.start &&
        stopLabelledTime < v.range.end
    );
    if (strictlyOverlappingLabel) return true;
    return false;
  }
  checkConcatenateLabels(currentTime) {
    const { annotationIdColorMap } = this.state;
    var jsonComment = this.getSelectedChoices(
      this.state.labellingCategoryChoices
    );
    var currentLabelColor = this.getColor(jsonComment, this.state.colorDict);

    var previousLabel = this.getPreviousLabel(currentTime);
    if (previousLabel) {
      var previousLabelColor = annotationIdColorMap[previousLabel.id];
      if (
        currentTime == previousLabel.range.end &&
        currentLabelColor == previousLabelColor
      ) {
        return true;
      }
    }
    return false;
  }

  currentLabelDisplay(time) {
    var currentLabel = this.getCurrentLabel(time);
    if (currentLabel) {
      var jsonComment = JSON.parse(currentLabel.comments[0].body);
      var selectedValuesLabels = jsonComment.map((v) => v["selectedValue"]);
      var selectedValuesCommaSeparated = selectedValuesLabels.join(", ");
      var selectedColor = this.getColor(jsonComment, this.state.colorDict);

      this.setState({
        currentTimeLabel: selectedValuesCommaSeparated,
        currentTimeLabelColor: selectedColor,
      });
    } else {
      this.setState({
        currentTimeLabel: null,
        currentTimeLabelColor: null,
      });
    }
  }

  renderVideoPlayer(videoFileURL, videoFileType, hash, convertedDate) {
    // instantiate Video.js
    this.player = videojs(
      this.videoNode,
      this.props.videoPlayerOptions,
      function onPlayerReady() {
        this.src({ type: videoFileType, src: videoFileURL });
        this.load();
        this.addClass("video-0");
      }
    );

    this.advVideoPlayer = videojs(
      this.advVideoNode,
      this.props.advancedVideoPlayerOptions,
      function onPlayerReady() {
        this.src({ type: videoFileType, src: videoFileURL });
        this.load();
        this.addClass("video-0");
      }
    );

    this.player.on("loadedmetadata", () => {
      const { zoomInMarkerGapPercent } = this.state;
      this.player.playbackRate(this.state.videoSpeed);
      var rangeValues = [];
      var firstZoomRangeMarker = 0;
      var secondZoomRangeMarker =
        (zoomInMarkerGapPercent / 100) * this.player.duration();
      rangeValues[0] = firstZoomRangeMarker;
      rangeValues[1] = secondZoomRangeMarker;

      var categoryChoices = this.getLabellingDataFromCSV();
      var colorDict = this.getColorDict(categoryChoices);
      var annotationIdColorMap = {};

      // var annotations = this.populateAnnotations(
      //   categoryChoices,
      //   colorDict,
      //   annotationIdColorMap
      // );
      var annotations = [];
      this.loadAnnotationPlugin(
        annotations,
        categoryChoices,
        colorDict,
        annotationIdColorMap
      );
      this.drawZoomedInLabels(
        rangeValues[0],
        rangeValues[1],
        this.annotationPlugin.options.annotationsObjects,
        annotationIdColorMap
      );

      this.setState({
        player: this.player,
        advPlayerObj: this.advVideoPlayer,
        videoCreatedDate: convertedDate,
        rangeValues: rangeValues,
        videoHash: hash,
      });
    });

    // full screen toggle disable
    this.player.on("fullscreenchange", (event) => {
      this.player.exitFullscreen();
    });

    this.player.on("timeupdate", () => {
      if (
        this.player.currentTime() >= this.state.rangeValues[1] ||
        this.player.currentTime() <= this.state.rangeValues[0]
      ) {
        const { zoomInMarkerGapPercent } = this.state;
        var firstZoomRangeMarker = this.player.currentTime();
        var secondZoomRangeMarker = Math.min(
          firstZoomRangeMarker +
            (zoomInMarkerGapPercent / 100) * this.player.duration(),
          this.player.duration()
        );
        if (firstZoomRangeMarker < secondZoomRangeMarker)
          self.moveZoomInMarkers(firstZoomRangeMarker, secondZoomRangeMarker);
      }
      this.currentLabelDisplay(this.player.currentTime());
      this.adjustCustomSeekBarProgress(
        this.state.rangeValues[0],
        this.state.rangeValues[1]
      );
    });

    //vidoejs markers
    this.player.markers({
      onMarkerReached: function (marker) {
        // console.log(marker);
      },
      markerTip: {
        display: false,
      },
      markers: [],
    });
    setTimeout(function () {
      ReactTooltip.rebuild();
      self.markPlayer();
      self.updateLabelsDefaultTimelineAfterDOMLoad(
        self.annotationPlugin.options.annotationsObjects
      );
      self.resizableCustomProgressBar();
    }, 2000);

    this.updateAdvPlayerCurrentTimeBySkipSeconds(0, this.advVideoPlayer);

    var self = this;
    var seekTime = 10;
    var speedFactor = 0.1;
    this.player.ready(function () {
      //keyboard shortcuts
      this.hotkeys({
        volumeStep: 0.1,
        seekStep: seekTime,
        enableModifiersForNumbers: false,
        forwardKey: function (event, player) {
          if (event.which === 39 && !event.shiftKey) {
            var updatedCurrentTime = player.currentTime() + seekTime;
            self.updateAdvPlayerCurrentTimeBySkipSeconds(
              updatedCurrentTime,
              self.advVideoPlayer
            );
            return true;
          }
          return false;
        },
        rewindKey: function (event, player) {
          if (event.which === 37 && !event.shiftKey) {
            var updatedCurrentTime = player.currentTime() - seekTime;
            self.updateAdvPlayerCurrentTimeBySkipSeconds(
              updatedCurrentTime,
              self.advVideoPlayer
            );
            return true;
          }
          return false;
        },
        volumeUpKey: function (event, player) {
          if (event.which === 38 && !event.shiftKey) {
            const { videoSpeed } = self.state;
            //increase frame rate of video
            var updatedSpeed = +videoSpeed + +speedFactor;
            updatedSpeed = Math.round(updatedSpeed * 1000) / 1000;
            player.playbackRate(updatedSpeed);
            self.advVideoPlayer.playbackRate(updatedSpeed);
            self.setState({
              videoSpeed: updatedSpeed,
            });
            return true;
          }
          return false;
        },
        volumeDownKey: function (event, player) {
          if (event.which === 40 && !event.shiftKey) {
            const { videoSpeed } = self.state;
            //decrease frame rate of video
            var updatedSpeed = +videoSpeed - +speedFactor;
            updatedSpeed = Math.round(updatedSpeed * 1000) / 1000;
            player.playbackRate(updatedSpeed);
            self.advVideoPlayer.playbackRate(updatedSpeed);
            self.setState({
              videoSpeed: updatedSpeed,
            });
            return true;
          }
          return false;
        },
        customKeys: {
          // Create custom hotkeys
          AKey: {
            key: function (event) {
              // Toggle something with A Key
              return event.which === 65;
            },
            handler: function (player, options, event) {
              const { label } = self.state;
              if (label.mode) {
                //stop labelling
                self.removeMarkersByClassName("start-label");
                var stopLabelledTime = player.currentTime();
                var labelStartTime = Math.min(
                  label.startTime,
                  stopLabelledTime
                );
                var strictlyOverlappingLabel =
                  self.checkStrictlyOverlappingLabel(
                    labelStartTime,
                    stopLabelledTime
                  );
                if (strictlyOverlappingLabel) {
                  alert("Cannot Label, its a strictly overlapping label!");
                  self.setState({
                    label: {
                      ...self.state.label,
                      mode: false,
                    },
                  });
                  return;
                }

                var overlappingLabel =
                  self.checkOverlappingLabel(labelStartTime);
                var concatenatePreviousLabel =
                  self.checkConcatenateLabels(labelStartTime);
                if (concatenatePreviousLabel) {
                  var previousLabel = self.getPreviousLabel(labelStartTime);
                  var previousLabelStartTime = 0;
                  if (previousLabel)
                    previousLabelStartTime = previousLabel.range.start;
                  //delete previous or current label
                  self.resetCurrentLabel(labelStartTime);
                  labelStartTime = previousLabelStartTime;
                } else if (overlappingLabel) {
                  //delete previous or current label
                  var currentLabel = self.getCurrentLabel(labelStartTime);
                  console.log(currentLabel["range"]["start"]);
                  self.resetCurrentLabel(labelStartTime);
                  var updatedEndTime = labelStartTime;
                  var updatedStartTime = currentLabel["range"]["start"];
                  self.createLabelFromExisting(
                    updatedStartTime,
                    updatedEndTime,
                    currentLabel
                  );
                }
                var labelEndTime = Math.max(label.startTime, stopLabelledTime);
                self.createLabel(labelStartTime, labelEndTime);
                var annotationIdColorMap = self.state.annotationIdColorMap;
                player.currentTime(labelEndTime);
                player.play();
                self.setState({
                  label: {
                    ...self.state.label,
                    mode: false,
                  },
                  annotationIdColorMap: annotationIdColorMap,
                });

                self.drawZoomedInLabels(
                  self.state.rangeValues[0],
                  self.state.rangeValues[1],
                  self.annotationPlugin.annotationState.data,
                  annotationIdColorMap
                );
              } else {
                //start labelling
                var currentTime = player.currentTime();
                player.markers.add([
                  {
                    time: currentTime,
                    text: currentTime,
                    class: "start-label",
                  },
                ]);
                self.setState({
                  label: {
                    ...self.state.label,
                    mode: true,
                    startTime: currentTime,
                  },
                });
              }
            },
          },
          shiftleftarrowKey: {
            key: function (event) {
              // Toggle something with shift + left arrow Key
              return event.shiftKey && event.which === 37;
            },
            handler: function (player, options, event) {
              player.pause();
              var previousLabel = self.getPreviousLabel(player.currentTime());
              var previousLabelEndTime = 0;
              if (previousLabel) previousLabelEndTime = previousLabel.range.end;
              player.currentTime(previousLabelEndTime);
              var updatedCurrentTime = player.currentTime() + seekTime;
              self.updateAdvPlayerCurrentTimeBySkipSeconds(
                updatedCurrentTime,
                self.advVideoPlayer
              );
            },
          },
          shiftrightarrowKey: {
            key: function (event) {
              // Toggle something with shift + right arrow Key
              return event.shiftKey && event.which === 39;
            },
            handler: function (player, options, event) {
              player.pause();
              var nextLabelStartTime = self.getNextLabelStartTime(
                player.currentTime(),
                player.duration()
              );
              console.log(nextLabelStartTime);
              player.currentTime(nextLabelStartTime);
              var updatedCurrentTime = player.currentTime() + seekTime;
              self.updateAdvPlayerCurrentTimeBySkipSeconds(
                updatedCurrentTime,
                self.advVideoPlayer
              );
            },
          },
          shiftPageUpKey: {
            key: function (event) {
              // Toggle something with shift + page up Key
              return event.shiftKey && event.which === 38;
            },
            handler: function (player, options, event) {
              const { skipSeconds, currentSkipSeconds } = self.state;
              //increase skip seconds of video
              var updatedSkipSeconds = +currentSkipSeconds + +skipSeconds;
              self.updateAdvPlayerCurrentTimeBySkipSeconds(
                player.currentTime() + skipSeconds,
                self.advVideoPlayer
              );
              self.setState({
                currentSkipSeconds: updatedSkipSeconds,
              });
            },
          },
          shiftPageDownKey: {
            key: function (event) {
              // Toggle something with shift + page down Key
              return event.shiftKey && event.which === 40;
            },
            handler: function (player, options, event) {
              const { skipSeconds, currentSkipSeconds } = self.state;
              //decrease skip seconds of video
              var updatedSkipSeconds = +currentSkipSeconds - +skipSeconds;
              if (updatedSkipSeconds >= 10) {
                self.updateAdvPlayerCurrentTimeBySkipSeconds(
                  player.currentTime() - skipSeconds,
                  self.advVideoPlayer
                );
                self.setState({
                  currentSkipSeconds: updatedSkipSeconds,
                });
              }
            },
          },
          dKey: {
            key: function (event) {
              // Toggle something with d Key
              return event.which === 68;
            },
            handler: function (player, options, event) {
              self.player.pause();
              var confirm = window.confirm("Do you want to delete all labels?");
              if (confirm) self.resetToDefault();
            },
          },
          sKey: {
            key: function (event) {
              // Toggle something with s Key
              return event.which === 83;
            },
            handler: function (player, options, event) {
              self.player.pause();
              var confirm = window.confirm(
                "Do you want to delete the current label?"
              );
              if (confirm) self.resetCurrentLabel(player.currentTime());
            },
          },
          gKey: {
            key: function (event) {
              // Toggle something with g Key
              return event.which === 71;
            },
            handler: function (player, options, event) {
              self.player.pause();
              self.toggleCategoryChoicesDialog();
            },
          },
          zKey: {
            key: function (event) {
              // Toggle something with z Key
              return event.which === 90;
            },
            handler: function (player, options, event) {
              //cancel annotation mode
              const { label } = self.state;
              if (label["mode"]) {
                self.removeMarkersByClassName("start-label");
                player.pause();
                player.currentTime(label["startTime"]);
                self.setState({
                  label: {
                    ...self.state.label,
                    mode: false,
                    startTime: null,
                  },
                });
              }
            },
          },
        },
      });
    });
    // on click the center part of the video
    this.player.on("play", function (event) {
      self.advVideoPlayer.play();
    });
    this.player.on("pause", function (event) {
      self.advVideoPlayer.pause();
    });

    //on clicking the progresscontrol bar
    this.player.controlBar.progressControl.on("mouseup", function (event) {
      var containsVjsMarkerClass = $(event.target).hasClass("vjs-marker");
      if (!containsVjsMarkerClass) {
        self.updateAdvPlayerCurrentTimeBySkipSeconds(
          self.player.currentTime(),
          self.advVideoPlayer
        );
      }
    });
  }

  updateToolTip(annotationElement, annotationStateData, index) {
    var annotation = annotationStateData[index];
    var parsedAnnotationObj = JSON.parse(annotation.comments[0].body);
    var vacToolTipElement = $(annotationElement).find(".vac-tooltip");
    var timeStampElement = vacToolTipElement.find("b");
    var timeStampHtmlContent = timeStampElement.html();
    if (timeStampHtmlContent != null) {
      var startTime = timeStampHtmlContent.split("-")[0];
      var startTimeMinutes = startTime.split(":")[0];
      var startTimeSeconds = startTime.split(":")[1];
      var startSecondsFormat = +(startTimeMinutes * 60) + +startTimeSeconds;
      var endTime = timeStampHtmlContent.split("-")[1];
      var endTimeMinutes = endTime.split(":")[0];
      var endTimeSeconds = endTime.split(":")[1];
      var endSecondsFormat = +(endTimeMinutes * 60) + +endTimeSeconds;
      var startRangeSeconds = convertSecondsToDateFormat(startSecondsFormat);
      var endRangeSeconds = convertSecondsToDateFormat(endSecondsFormat);
      var toolTipContent = startRangeSeconds + "-" + endRangeSeconds;
      var htmlData = renderToString(
        this.renderSelectedChoicesTable(parsedAnnotationObj, true)
      );
      htmlData =
        `<div class=\"tooltipDiv\">${toolTipContent}&nbsp</div>` + htmlData;
      vacToolTipElement.html(htmlData);
    }
  }
  markBlackPixel(
    annotationElement,
    pixelThreshold,
    annoationMarkerParentWidth
  ) {
    var player = this.state.player;
    var totalDuration = player != null && player.duration();
    var widthInPixel = annotationElement.width();
    if (widthInPixel < pixelThreshold && player != null) {
      var leftSize = annotationElement.position().left;
      var leftPercentage = (leftSize / annoationMarkerParentWidth) * 100;

      var noOfSecondsFromLeft = (leftPercentage / 100) * totalDuration;
      //   console.log("black pixel markers", noOfSecondsFromLeft, leftPercentage, leftSize, widthInPixel, annoationMarkerParentWidth);
      player.markers.add([
        {
          time: noOfSecondsFromLeft,
          text: noOfSecondsFromLeft,
          class: "black-pixel",
        },
      ]);
    }
  }
  updateLabelsDefaultTimelineAfterDOMLoad(annotationStateData) {
    // highlight with marker for label less than 1 pixel
    var self = this;
    var annoationMarkerParent = $(".vac-marker-wrap");
    var sortedAnnoationMarkerParent = annoationMarkerParent
      .children()
      .sort(function (a, b) {
        var leftPercentage_A = parseInt($(a).css("left"));
        var leftPercentage_B = parseInt($(b).css("left"));
        if (leftPercentage_A < leftPercentage_B) {
          return -1;
        } else if (leftPercentage_A > leftPercentage_B) {
          return 1;
        } else {
          return 0;
        }
      });

    var annoationMarkerParentWidth = annoationMarkerParent.width();
    var pixelThreshold = 2;
    var index = 0;
    this.removeMarkersByClassName("black-pixel");
    sortedAnnoationMarkerParent.each(function (i) {
      var annotationElement = $(this);
      self.updateToolTip(annotationElement, annotationStateData, index);
      self.markBlackPixel(
        annotationElement,
        pixelThreshold,
        annoationMarkerParentWidth
      );
      self.colorLabelInDefaultTimeline(
        annotationElement,
        self.state.annotationIdColorMap,
        annotationStateData,
        index
      );
      index++;
    });
  }

  getSelectedChoices(categoryChoices) {
    var selectedList = [];
    for (var variableKey in categoryChoices) {
      var obj = categoryChoices[variableKey];
      selectedList.push({
        category: obj.variable,
        selectedValue: obj.selectedValue,
      });
    }
    return selectedList;
  }
  updateAdvPlayerCurrentTimeBySkipSeconds(mainPlayerCurrentTime, advPlayerObj) {
    const { currentSkipSeconds } = this.state;
    var afterSkipTime = mainPlayerCurrentTime + currentSkipSeconds;
    advPlayerObj.currentTime(afterSkipTime);
  }

  onLabelledRegionMouseClick() {
    // annotationOpened : Fired whenever an annotation is opened
    this.annotationPlugin.registerListener("annotationOpened", (event) => {
      if (!event.detail.triggered_by_timeline) {
        this.setState({
          openLabelledData: true,
          currentLabelledData: JSON.parse(
            event.detail.annotation.comments[0].body
          ),
        });
      }
    });
  }

  handleLabellingChoiceChange = (event, variableObj) => {
    this.setState((prevState) => ({
      labellingCategoryChoices: prevState.labellingCategoryChoices.map((e) =>
        e.variable == variableObj.variable
          ? { ...e, selectedValue: event.target.value }
          : e
      ),
    }));
  };
  closeLabelledDataDialog = () => {
    this.setState({
      openLabelledData: false,
    });
  };

  toggleCategoryChoicesDialog = () => {
    this.setState({
      categoryChoicesDialog: !this.state.categoryChoicesDialog,
    });
  };
  onDialogKeyDownEvent = (event) => {
    var x = event.which || event.keyCode;
    if (x == 71) this.toggleCategoryChoicesDialog();
  };
  handleCustomSeekbarClick = (event) => {
    let offsetLeft = this.seekbarDivReference.getBoundingClientRect().left;
    let totalWidth = this.seekbarDivReference.offsetWidth;
    var left = event.pageX - offsetLeft;
    var percentage = left / totalWidth;
    var durationRelativeToSliderTimes =
      this.state.rangeValues[1] - this.state.rangeValues[0];
    var vidTime =
      this.state.rangeValues[0] + durationRelativeToSliderTimes * percentage;
    this.player.currentTime(vidTime);
    this.updateAdvPlayerCurrentTimeBySkipSeconds(vidTime, this.advVideoPlayer);
  };

  handleZoomedInLabelClick(annotation) {
    this.setState({
      openLabelledData: true,
      currentLabelledData: JSON.parse(annotation.comments[0].body),
    });
  }
  getActiveLabels() {
    const { labellingCategoryChoices } = this.state;
    if (labellingCategoryChoices) {
      var activeLabels = labellingCategoryChoices.map(
        (v) => v["selectedValue"]
      );
      var selectedValuesCommaSeparated = activeLabels.join(", ");
      return selectedValuesCommaSeparated;
    }
  }
  renderSelectedChoicesTable(currentLabelledData, isTooltip) {
    if (currentLabelledData != null) {
      var activeLabels = currentLabelledData.map((v) => v["selectedValue"]);
      var selectedValuesCommaSeparated = activeLabels.join(", ");
      return <div className="tooltipDiv">{selectedValuesCommaSeparated}</div>;
    }
    // return (
    //   <Table bordered className={isTooltip && "tooltipTable"}>
    //     <thead>
    //       <tr>
    //         <th>Category</th>
    //         <th>Selected</th>
    //       </tr>
    //     </thead>
    //     <tbody>
    //       {currentLabelledData != null &&
    //         currentLabelledData.map((v) => {
    //           return (
    //             <tr>
    //               <td>{v.category}</td>
    //               <td>{v.selectedValue}</td>
    //             </tr>
    //           );
    //         })}
    //     </tbody>
    //   </Table>
    // );
  }
  handleExportLabel(event) {
    var fileName = "labels";
    var exportObj = {
      annotations: this.annotationPlugin.annotationState.data,
      videoHash: this.state.videoHash,
    };
    const fileData = JSON.stringify(exportObj, null, 4);
    const blob = new Blob([fileData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${fileName}.json`;
    link.href = url;
    link.click();
  }

  handleExportLabelAsCsv(event) {
    const { videoCreatedDate } = this.state;
    var annotationsData = this.annotationPlugin.annotationState.data;
    console.log(annotationsData, this.state.labellingCategoryChoices);
    var obj = {};
    for (var i = 0; i < annotationsData.length; i++) {
      var annotation = annotationsData[i];
      var jsonComment = JSON.parse(annotation["comments"][0]["body"]);
      for (var j = 0; j < jsonComment.length; j++) {
        var value = jsonComment[j];
        var category = value["category"];
        var selectedValue = value["selectedValue"];
        var entry = {
          startTime:
            videoCreatedDate +
            " " +
            convertSecondsToDateFormat(annotation.range.start),
          stopTime:
            videoCreatedDate +
            " " +
            convertSecondsToDateFormat(annotation.range.end),
          prediction: selectedValue,
          source: "Video Annotator",
          lableset: category,
        };
        if (obj.hasOwnProperty(category)) {
          var array = obj[category];
          array.push(entry);
        } else {
          var array = [];
          array.push(entry);
          obj[category] = array;
        }
      }
    }
    console.log(obj);
    let zip = new JSZip();
    for (var key in obj) {
      var value = obj[key];
      var csvString = "START_TIME,STOP_TIME,PREDICTION,SOURCE,LABELSET\r\n";
      for (var i = 0; i < value.length; i++) {
        var entry = value[i];
        var commaSeparated = Object.keys(entry)
          .map(function (k) {
            return entry[k];
          })
          .join(",");
        csvString = csvString + commaSeparated + "\r\n";
      }
      zip.file(`${key}.csv`, csvString);
    }

    zip.generateAsync({ type: "blob" }).then(function (content) {
      FileSaver.saveAs(content, "CSVLabels.zip");
    });
  }
  rotate(player) {
    var video_0 = player.hasClass("video-0");
    var video_90 = player.hasClass("video-90");
    var video_180 = player.hasClass("video-180");

    if (video_0) {
      player.removeClass("video-0");
      player.addClass("video-90");
    } else if (video_90) {
      player.removeClass("video-90");
      player.addClass("video-180");
    } else if (video_180) {
      player.removeClass("video-180");
      player.addClass("video-270");
    } else {
      player.removeClass("video-270");
      player.addClass("video-0");
    }
  }
  handleVideoRotate() {
    this.rotate(this.player);
    this.rotate(this.advVideoPlayer);
  }
  playerLoaded() {
    return this.state.player != null;
  }
  reloadPage() {
    window.location.reload(false);
  }

  handleEditMode() {
    this.annotationPlugin.fire("addingAnnotation");
  }
  renderCategoryChoices() {
    return (
      <div>
        <Table className="category" bordered>
          <thead>
            <tr>
              <th>Category</th>
              <th>Choice(s)</th>
              <th>Active labels</th>
            </tr>
          </thead>
          <tbody>
            {this.state.labellingCategoryChoices.map((v) => {
              return (
                <tr>
                  <td>{v.variable}</td>
                  <td>
                    {" "}
                    <Select
                      value={v.selectedValue}
                      onChange={(e) => this.handleLabellingChoiceChange(e, v)}
                      displayEmpty
                      inputProps={{ "aria-label": "Without label" }}
                    >
                      {v.values.map((singleValue) => {
                        return (
                          <MenuItem value={singleValue}>{singleValue}</MenuItem>
                        );
                      })}
                    </Select>
                  </td>
                  <td>{v.selectedValue}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  }
  // wrap the player in a div with a `data-vjs-player` attribute
  // so videojs won't create additional wrapper in the DOM
  // see https://github.com/videojs/video.js/pull/3856
  render() {
    return (
      <div>
        <ReactTooltip />
        <Dialog
          onClose={this.closeLabelledDataDialog}
          aria-labelledby="simple-dialog-title"
          open={this.state.openLabelledData}
        >
          <DialogTitle id="simple-dialog-title">Category Choices</DialogTitle>
          {this.renderSelectedChoicesTable(
            this.state.currentLabelledData,
            false
          )}
        </Dialog>
        <Dialog
          onClose={this.toggleCategoryChoicesDialog}
          aria-labelledby="category-choices"
          open={this.state.categoryChoicesDialog}
          onKeyDown={this.onDialogKeyDownEvent}
        >
          <DialogTitle id="category-choices">Category Choices</DialogTitle>
          {this.renderCategoryChoices()}
        </Dialog>

        <div className="video-players">
          <div data-vjs-player>
            <video
              ref={(node) => (this.videoNode = node)}
              className="video-js default-video"
            ></video>
            {this.playerLoaded() && (
              <div>
                {this.state.zoomedInAnnotationList.length > 0 &&
                  this.state.zoomedInAnnotationList.map((annotation) => {
                    var backgroundColor = annotation.color;
                    var leftPercentage = annotation.rangePercentage.start;
                    var widthPercentage =
                      annotation.rangePercentage.end -
                      annotation.rangePercentage.start;
                    var startFormat = convertSecondsToDateFormat(
                      annotation.range.start
                    );
                    var endFormat = convertSecondsToDateFormat(
                      annotation.range.end
                    );
                    var tooltip = startFormat + "-" + endFormat;

                    var htmlData = renderToString(
                      this.renderSelectedChoicesTable(
                        JSON.parse(annotation.comments[0].body),
                        true
                      )
                    );
                    htmlData =
                      '<div class="tooltipDiv">' +
                      tooltip +
                      "&nbsp</div>" +
                      htmlData;

                    return (
                      <div
                        data-tip={htmlData}
                        data-html={true}
                        style={{
                          left: `${leftPercentage}%`,
                          width: `${widthPercentage}%`,
                          backgroundColor: `${backgroundColor}`,
                        }}
                        // onClick={(e) =>
                        //   this.handleZoomedInLabelClick(annotation)
                        // }
                        className={
                          annotation.active
                            ? "zoomedLabel zoomedLabel-active"
                            : "zoomedLabel"
                        }
                      ></div>
                    );
                  })}
                <div
                  id="custom-seekbar"
                  onClick={this.handleCustomSeekbarClick}
                  ref={(el) => (this.seekbarDivReference = el)}
                >
                  <span
                    className="customprogress-bar"
                    style={{ width: `${this.state.progressPercentage}%` }}
                  >
                    {" "}
                  </span>
                </div>

                <div className="customSeekbarControlBar">
                  <div className="seekbarTimeStartTime">
                    {convertSecondsToDateFormat(this.state.rangeValues[0])}
                  </div>
                  <div className="customSeekbarTimeDivider">/</div>
                  <div className="seekbarTimeEndTime">
                    {convertSecondsToDateFormat(this.state.rangeValues[1])}
                  </div>
                  {convertSecondsToDateFormat(this.state.player.currentTime())}(
                  {Math.round(this.state.progressPercentage)}%)
                </div>
              </div>
            )}
          </div>

          <div data-vjs-player>
            <video
              ref={(node) => (this.advVideoNode = node)}
              className="video-js preview-video"
            ></video>
          </div>
        </div>
        <Row style={{ marginLeft: "initial", marginRight: "initial" }}>
          <Col>
            <Row>
              <Col md={1}>
                {this.playerLoaded() && (
                  <div className="frameRate">{this.state.videoSpeed}x</div>
                )}
              </Col>
              <Col md={2}>
                {this.playerLoaded() && (
                  <div className="skipSeconds">
                    {this.state.currentSkipSeconds} sec
                  </div>
                )}
              </Col>
              <Col md={1}>
                {this.state.label["mode"] && (
                  <div className="startLabelTime">
                    {convertSecondsToDateFormat(this.state.label["startTime"])}
                  </div>
                )}
              </Col>
              <Col className="activeLabels">{this.getActiveLabels()}</Col>
            </Row>
            <Row>
              <Col
                className="currentLabel"
                md={{ offset: 4 }}
                style={{ color: this.state.currentTimeLabelColor }}
              >
                {this.state.currentTimeLabel}
              </Col>
            </Row>
          </Col>
          <Col>
            {" "}
            <Row>
              <Col>
                <button onClick={() => this.importVideo.current.click()}>
                  Import Video
                </button>
                {/* <button onClick={(e) => this.handleEditMode(e)}>
                  Edit mode
                </button> */}
                <form id="videoFile">
                  <input
                    type="file"
                    name="video"
                    multiple={false}
                    ref={this.importVideo}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      this.handleVideoLoad(e);
                    }}
                  />
                </form>
              </Col>
              <Col>
                {" "}
                {this.playerLoaded() && (
                  <div style={{ display: "inline-block" }}>
                    <button onClick={this.reloadPage}>Reload</button>
                  </div>
                )}
              </Col>
              <Col>
                {this.playerLoaded() && (
                  <button onClick={() => this.importLabel.current.click()}>
                    Import Label
                  </button>
                )}

                <input
                  type="file"
                  name="video"
                  multiple={false}
                  ref={this.importLabel}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    this.handleImportLabel(e);
                  }}
                />
              </Col>
              <Col>
                {this.playerLoaded() && (
                  <div>
                    <button
                      // variant="contained"
                      // color="primary"
                      // size="small"
                      onClick={(e) => this.handleExportLabel(e)}
                    >
                      Export Label
                    </button>
                  </div>
                )}
              </Col>
              <Col>
                {this.playerLoaded() && (
                  <div>
                    <button onClick={(e) => this.handleExportLabelAsCsv(e)}>
                      Export Label(CSV)
                    </button>
                  </div>
                )}
              </Col>
              <Col>
                {this.playerLoaded() && (
                  <div>
                    <button onClick={(e) => this.handleVideoRotate(e)}>
                      Rotate video
                    </button>
                  </div>
                )}
              </Col>
            </Row>
          </Col>
        </Row>
      </div>
    );
  }
}
