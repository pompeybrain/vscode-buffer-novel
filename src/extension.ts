// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { StatusBarItem } from "vscode";
import path = require("path");
import fs = require("fs");
import { template as tpl } from "./code-template";

const lineWidth = 40; // 中文40，英文80

// this method is called when your extension is deactivated
export function deactivate() {}

// 展示的小说路径
let novelPath = "";
// 小说内容按行存储
let novelLines: any[] = [];

// 总共的页码
let totalPage = 0;
// 状态栏
let processBar: StatusBarItem;
let nextBar: StatusBarItem;
let prevBar: StatusBarItem;
let jumpBar: StatusBarItem;

let globalStates: any = null;
// 字符串占位符
function convertToCode(tpl: string, lines: any[]) {
  for (var i = 0; i < lines.length; i++) {
    let lineText = lines[i];
    lineText = lineText.trim();
    console.log(lineText);
    console.log(lineText.length);
    if (lineText.length > lineWidth) {
      let splitNum = Math.floor(lineText.length / lineWidth);
      for (let j = 1; j <= splitNum; j++) {
        lineText = strInsert(lineText, j * 3 - 3 + j * lineWidth, `\n// `);
      }
    }
    tpl = tpl.replace(new RegExp("\\{" + i + "\\}", "g"), lineText);
  }
  return tpl;
}

function strInsert(str: string, start: number, text: string) {
  return str.slice(0, start) + text + str.slice(start);
}

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context: vscode.ExtensionContext) {
  init();
  let open = vscode.commands.registerCommand("codeNovel.openNovel", () => {
    const options = {
      // 选中第3行第9列到第3行第17列
      //selection: new vscode.Range(new vscode.Position(2, 8), new vscode.Position(2, 16));
      // 是否预览，默认true，预览的意思是下次再打开文件是否会替换当前文件
      //preview: false,
      // 显示在第二个编辑器
      viewColumn: vscode.ViewColumn.One,
    };
    vscode.window
      .showTextDocument(vscode.Uri.file(novelPath), options)
      .then(editor => {
        // console.log(editor);
      });
  });
  // 下一页
  let next = vscode.commands.registerCommand("codeNovel.nextpage", () => {
    nextPage();
  });
  // 上一页
  let prev = vscode.commands.registerCommand("codeNovel.prevpage", () => {
    prePage();
  });
  // 跳页
  let jump = vscode.commands.registerCommand("codeNovel.jumppage", () => {
    vscode.window
      .showInputBox({
        placeHolder: "请输入页码",
      })
      .then(value => {
        if (value) {
          jumpPage(value);
        }
      });
  });
  let clickBar = vscode.commands.registerCommand(
    "codeNovel.clickStatusBar",
    () => {
      vscode.window
        .showQuickPick(Object.keys(globalStates["books"]))
        .then(value => {
          // console.log(value);
          if (value && globalStates["currentBook"] !== value) {
            changeBook(value);
          }
        });
    }
  );
  vscode.window.onDidChangeActiveTextEditor(editor => {
    // console.log(editor);
    if (isNovelBuffer(editor)) {
      processBar.show();
      nextBar.show();
      prevBar.show();
      jumpBar.show();
    } else {
      processBar.hide();
      nextBar.hide();
      prevBar.hide();
      jumpBar.hide();
    }
  });
  context.subscriptions.push(open);
  context.subscriptions.push(next);
  context.subscriptions.push(prev);
  context.subscriptions.push(jump);
  context.subscriptions.push(clickBar);
}

function init() {
  initPathAndEnv();
  initNovelInfo();
  initStatusBar();
  getPage();
  if (isNovelBuffer(vscode.window.activeTextEditor)) {
    processBar.show();
    nextBar.show();
    prevBar.show();
    jumpBar.show();
  }
}

function initPathAndEnv() {
  console.log("初始化环境");
  // 展示的模板路径
  novelPath = path.join(__dirname, "my-utils.js");
  // 配置路径，记录了当前读的进度
  const envPath = path.join(__dirname, "globalStates.json");
  // 读取配置
  let envStr;
  try {
    envStr = fs.readFileSync(envPath).toString();
  } catch (error) {}
  globalStates = envStr ? JSON.parse(envStr) : {};
  const booksDir = path.join(__dirname, "../books");
  let books = fs.readdirSync(booksDir);
  books = books.filter(book => book.endsWith("txt"));

  books.forEach(book => {
    if (!globalStates["books"]) {
      globalStates["books"] = {};
    } else {
      Object.keys(globalStates["books"]).forEach(k => {
        if (!books.find(b => b === k)) {
          delete globalStates["books"][k];
        }
      });
    }
    if (!globalStates["books"][book]) {
      globalStates["books"][book] = 1;
    }
  });

  if (books.length === 0) {
    throw new Error(
      `没有txt格式的书籍,请在路径${path.join(__dirname, "books")}下放置书籍!`
    );
  }
  if (
    !globalStates["currentBook"] ||
    !books.find(b => b === globalStates["currentBook"])
  ) {
    globalStates["currentBook"] = books[0];
  }
}

// 初始化小说内容
function initNovelInfo() {
  var content = fs.readFileSync(
    path.join(__dirname, "../books", globalStates["currentBook"])
  );
  novelLines = content.toString().split("\n");
  totalPage = Math.ceil(novelLines.length / 100);
}
// 初始化状态栏
function initStatusBar() {
  const message = `${globalStates["currentBook"]}   ${
    globalStates["books"][globalStates["currentBook"]]
  } | ${totalPage}`;
  // 进度bar
  processBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  );
  processBar.text = message;
  processBar.command = "codeNovel.clickStatusBar";

  // 上一页的bar
  prevBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  prevBar.text = "上一页";
  prevBar.command = "codeNovel.prevpage";

  // 下一页的bar
  nextBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  nextBar.text = "下一页";
  nextBar.command = "codeNovel.nextpage";

  jumpBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  jumpBar.text = "跳页";
  jumpBar.command = "codeNovel.jumppage";
}
// 获取当前页数据
function getPage() {
  const lines = novelLines.slice(
    (globalStates["books"][globalStates["currentBook"]] - 1) * 100,
    globalStates["books"][globalStates["currentBook"]] * 100
  );
  var codeText = convertToCode(tpl, lines);
  fs.writeFileSync(novelPath, codeText);
  if (processBar) {
    processBar.text = `${globalStates["currentBook"]}   ${
      globalStates["books"][globalStates["currentBook"]]
    } | ${totalPage}`;
  }
  scrollToTop();
  updateEnv();
}
// 更新用户进度
function updateEnv() {
  const envPath = path.join(__dirname, "globalStates.json");
  fs.writeFileSync(envPath, JSON.stringify(globalStates));
}
// 下一页
function nextPage() {
  if (isNovelBuffer(vscode.window.activeTextEditor)) {
    if (globalStates["books"][globalStates["currentBook"]] < totalPage) {
      globalStates["books"][globalStates["currentBook"]]++;
    }
    getPage();
  }
}

// 上一页
function prePage() {
  if (isNovelBuffer(vscode.window.activeTextEditor)) {
    if (globalStates["books"][globalStates["currentBook"]] > 1) {
      globalStates["books"][globalStates["currentBook"]]--;
    }
    getPage();
  }
}

// 跳頁
function jumpPage(page: any) {
  if (!isNovelBuffer(vscode.window.activeTextEditor)) {
    return;
  }

  if (isNumber(page)) {
    if (page < 1 || page > totalPage) {
      vscode.window.showWarningMessage(`页码范围1-${totalPage}`);
      return;
    } else {
      globalStates["books"][globalStates["currentBook"]] = page;
      getPage();
    }
  } else {
    vscode.window.showWarningMessage(`请输入数字`);
  }
}
// 切换书
function changeBook(book: any) {
  globalStates["currentBook"] = book;
  initNovelInfo();
  getPage();
}
// 切换页后将光标定位到第一行
function scrollToTop() {
  let editor = vscode.window.activeTextEditor;
  if (editor) {
    let range = editor.document.lineAt(0).range;
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range);
  }
}

function isNumber(nubmer: any) {
  var re = /^[0-9]+.?[0-9]*$/; //判断字符串是否为数字 //判断正整数 /^[1-9]+[0-9]*]*$/
  if (!re.test(nubmer)) {
    return false;
  }
  return true;
}

function isNovelBuffer(editor: vscode.TextEditor | undefined) {
  return (
    editor &&
    editor.document.uri.fsPath &&
    editor.document.uri.fsPath.toLocaleLowerCase() ===
      path.join(__dirname, "my-utils.js").toLocaleLowerCase()
  );
}
