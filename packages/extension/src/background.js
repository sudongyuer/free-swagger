const KEY = "FREE_SWAGGER_CHROME";
const { isObject } = require("lodash");

const getMap = () => {
  const map = localStorage.getItem(KEY);
  if (!map) {
    return null;
  }
  try {
    return JSON.parse(map);
  } catch (e) {
    return null;
  }
};

const get = (key) => {
  const map = getMap();
  if (!map) {
    return null;
  }
  if (!key) return map;
  try {
    return map[key];
  } catch (e) {
    return null;
  }
};

const set = (key, val) => {
  const map = getMap();
  const item = isObject(map?.[key]) ? { ...map[key], ...val } : val;
  const newMap = map ? { ...map, [key]: item } : { [key]: val };
  return localStorage.setItem(KEY, JSON.stringify(newMap));
};

const setOpen = (key) => {
  return set(key, { isOpen: true });
};

const setActive = (key) => {
  return set(key, { isActive: true });
};

const setClose = (key) => {
  return set(key, { isOpen: false, isActive: false });
};

const iconClick = (tab) => {
  const item = get(tab.id);
  if (!item || !item.isOpen) {
    setOpen(tab.id);
  } else {
    setClose(tab.id);
  }
  chrome.tabs.reload(tab.id);
};

const setIcon = ({ tabId }) => {
  if (!tabId) return;
  const item = get(tabId);
  // 开启 icon
  if (item?.isOpen) {
    chrome.browserAction.setIcon({
      path: "https://z3.ax1x.com/2021/08/08/fQE0qs.png",
    });
    return;
  }
  // 关闭 icon
  chrome.browserAction.setIcon({
    path: "https://z3.ax1x.com/2021/08/08/fQEYPf.png",
  });
};

const update = (tabId) => {
  setIcon({ tabId });
  const item = get(tabId);
  // active 和 open 的区别在于
  // 当用户点击图标打开插件时 open=true active=false
  // 执行插件代码时 open=true active=true
  if (!item || !item.isOpen || item.isActive) return;
  setActive(tabId);
  chrome.tabs.executeScript({
    code: `
        console.log('free-swagger-extension start')
        const url =
          'https://cdn.jsdelivr.net/npm/free-swagger-userscript/dist/userScript.js'
        const script = document.createElement('script')
        script.setAttribute('src', url)
        document.getElementsByTagName('head')[0].appendChild(script)
`,
  });
};

chrome.browserAction.onClicked.removeListener(iconClick);
chrome.browserAction.onClicked.addListener(iconClick);

chrome.tabs.onActivated.removeListener(setIcon);
chrome.tabs.onActivated.addListener(setIcon);

chrome.tabs.onCreated.removeListener(update);
chrome.tabs.onCreated.addListener(update);

chrome.tabs.onUpdated.removeListener(update);
chrome.tabs.onUpdated.addListener(update);