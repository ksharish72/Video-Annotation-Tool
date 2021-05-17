const HtmlWebPackPlugin = require("html-webpack-plugin");
var webpack = require("webpack");

const htmlPlugin = new HtmlWebPackPlugin({
  template: "./public/index.html",
  filename: "./index.html",
});

module.exports = {
  entry: __dirname + "/src/index.js",
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ["babel-loader"],
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.csv$/,
        loader: 'csv-loader',
        options: {
          dynamicTyping: true,
          header: true,
          skipEmptyLines: true
        }
      }
    ],
  },
  plugins: [
    htmlPlugin,
    new webpack.ProvidePlugin({
      React: "react",
    }),
  ],
  resolve: {
    fallback: {
      fs: false,
      child_process: false,
      crypto : false,
      path : false
    }
  }  
};
