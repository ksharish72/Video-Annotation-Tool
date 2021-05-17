import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import $ from "jquery";
import '@contently/videojs-annotation-comments/build/css/annotations.css';
import 'bootstrap/dist/css/bootstrap.min.css';

window.$ = $;

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);


