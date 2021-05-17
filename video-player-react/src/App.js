import "./App.css";
import VideoPlayer from "./VideoPlayer";
class App extends React.Component {
  super(props) {
    this.super(props);
  }
  render() {
    const videoPlayerOptions = {
      controls: true,
      controlBar: {
        fullscreenToggle: false
      },
      inactivityTimeout: 0,
      width: 600,
      height: 405,
      enableVolumeScroll: false,
      muted: true
    };
  
    const advancedVideoPlayerOptions = {
      controlBar: {
        volumePanel: false,
        playToggle: false,
        fullscreenToggle: false,
        progressControl: {
          seekBar: false,
        },
      },
      inactivityTimeout: 0,
      controls: true,
      width: 600,
      height: 405,
      muted: true
    };
    return (
      <div className="App">
        <VideoPlayer
          videoPlayerOptions={videoPlayerOptions}
          advancedVideoPlayerOptions={advancedVideoPlayerOptions}
        />
      </div>
    );
  }
}

export default App;
