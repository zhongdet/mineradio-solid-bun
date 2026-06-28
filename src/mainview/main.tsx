import "./app.css";
import { render } from "solid-js/web";
import App from "./App";

// Wait for DOM then render
const root = document.getElementById("app");
if (root) {
  render(() => <App />, root);
}
