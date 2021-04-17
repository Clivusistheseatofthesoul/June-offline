'use strict';

var obsidian = require('obsidian');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var util = require('util');

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () {
                        return e[k];
                    }
                });
            }
        });
    }
    n['default'] = e;
    return Object.freeze(n);
}

var path__namespace = /*#__PURE__*/_interopNamespace(path);

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

const DEFAULT_SETTINGS = {
    command_timeout: 5,
    template_folder: "",
    templates_pairs: [["", ""]],
};
class TemplaterSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.app = app;
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        let fragment = document.createDocumentFragment();
        let link = document.createElement("a");
        link.href = "https://silentvoid13.github.io/Templater/";
        link.text = "documentation";
        fragment.append("Check the ");
        fragment.append(link);
        fragment.append(" to get a list of all the available internal variables / functions.");
        new obsidian.Setting(containerEl)
            .setName("Template folder location")
            .setDesc("Files in this folder will be available as templates.")
            .addText(text => {
            text.setPlaceholder("Example: folder 1/folder 2")
                .setValue(this.plugin.settings.template_folder)
                .onChange((new_folder) => {
                this.plugin.settings.template_folder = new_folder;
                this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
            .setName("Timeout")
            .setDesc("Maximum timeout in seconds for a system command.")
            .addText(text => {
            text.setPlaceholder("Timeout")
                .setValue(this.plugin.settings.command_timeout.toString())
                .onChange((new_value) => {
                let new_timeout = Number(new_value);
                if (isNaN(new_timeout)) {
                    this.plugin.log_error("Timeout must be a number");
                    return;
                }
                this.plugin.settings.command_timeout = new_timeout;
                this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
            .setName("Internal Variables and Functions")
            .setDesc(fragment);
        let i = 1;
        this.plugin.settings.templates_pairs.forEach((template_pair) => {
            let div = containerEl.createEl('div');
            div.addClass("templater_div");
            let title = containerEl.createEl('h4', {
                text: 'User Function n°' + i,
            });
            title.addClass("templater_title");
            let setting = new obsidian.Setting(containerEl)
                .addExtraButton(extra => {
                extra.setIcon("cross")
                    .setTooltip("Delete")
                    .onClick(() => {
                    let index = this.plugin.settings.templates_pairs.indexOf(template_pair);
                    if (index > -1) {
                        this.plugin.settings.templates_pairs.splice(index, 1);
                        // Force refresh
                        this.plugin.saveSettings();
                        this.display();
                    }
                });
            })
                .addText(text => {
                let t = text.setPlaceholder('Function name')
                    .setValue(template_pair[0])
                    .onChange((new_value) => {
                    let index = this.plugin.settings.templates_pairs.indexOf(template_pair);
                    if (index > -1) {
                        this.plugin.settings.templates_pairs[index][0] = new_value;
                        this.plugin.saveSettings();
                    }
                });
                t.inputEl.addClass("templater_template");
                return t;
            })
                .addTextArea(text => {
                let t = text.setPlaceholder('System Command')
                    .setValue(template_pair[1])
                    .onChange((new_cmd) => {
                    let index = this.plugin.settings.templates_pairs.indexOf(template_pair);
                    if (index > -1) {
                        this.plugin.settings.templates_pairs[index][1] = new_cmd;
                        this.plugin.saveSettings();
                    }
                });
                t.inputEl.setAttr("rows", 4);
                t.inputEl.addClass("templater_cmd");
                return t;
            });
            setting.infoEl.remove();
            div.appendChild(title);
            div.appendChild(containerEl.lastChild);
            i += 1;
        });
        let div = containerEl.createEl('div');
        div.addClass("templater_div2");
        let setting = new obsidian.Setting(containerEl)
            .addButton(button => {
            let b = button.setButtonText("Add New User Function").onClick(() => {
                this.plugin.settings.templates_pairs.push(["", ""]);
                // Force refresh
                this.display();
            });
            b.buttonEl.addClass("templater_button");
            return b;
        });
        setting.infoEl.remove();
        div.appendChild(containerEl.lastChild);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function escapeRegExp$1(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function getTFilesFromFolder(app, folder_str) {
    folder_str = obsidian.normalizePath(folder_str);
    let folder = app.vault.getAbstractFileByPath(folder_str);
    if (!folder) {
        throw new Error(`${folder_str} folder doesn't exist`);
    }
    if (!(folder instanceof obsidian.TFolder)) {
        throw new Error(`${folder_str} is a file, not a folder`);
    }
    let files = [];
    obsidian.Vault.recurseChildren(folder, (file) => {
        if (file instanceof obsidian.TFile) {
            files.push(file);
        }
    });
    files.sort((a, b) => {
        return a.basename.localeCompare(b.basename);
    });
    return files;
}

var OpenMode;
(function (OpenMode) {
    OpenMode[OpenMode["InsertTemplate"] = 0] = "InsertTemplate";
    OpenMode[OpenMode["CreateNoteTemplate"] = 1] = "CreateNoteTemplate";
})(OpenMode || (OpenMode = {}));
class TemplaterFuzzySuggestModal extends obsidian.FuzzySuggestModal {
    constructor(app, plugin) {
        super(app);
        this.app = app;
        this.plugin = plugin;
    }
    getItems() {
        let template_files = [];
        if (this.plugin.settings.template_folder === "") {
            template_files = this.app.vault.getMarkdownFiles();
        }
        else {
            template_files = getTFilesFromFolder(this.app, this.plugin.settings.template_folder);
        }
        return template_files;
    }
    getItemText(item) {
        return item.basename;
    }
    onChooseItem(item, _evt) {
        switch (this.open_mode) {
            case OpenMode.InsertTemplate:
                this.plugin.parser.replace_templates_and_append(item);
                break;
            case OpenMode.CreateNoteTemplate:
                this.plugin.parser.create_new_note_from_template(item, this.creation_folder);
                break;
        }
    }
    start() {
        try {
            let files = this.getItems();
            // If there is only one file in the templates directory, we don't open the modal
            if (files.length === 1) {
                this.onChooseItem(files[0], null);
            }
            else {
                this.open();
            }
        }
        catch (error) {
            this.plugin.log_error(error);
        }
    }
    insert_template() {
        this.open_mode = OpenMode.InsertTemplate;
        this.start();
    }
    create_new_note_from_template(folder) {
        this.creation_folder = folder;
        this.open_mode = OpenMode.CreateNoteTemplate;
        this.start();
    }
}

function setPrototypeOf(obj, proto) {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    if (Object.setPrototypeOf) {
        Object.setPrototypeOf(obj, proto);
    }
    else {
        obj.__proto__ = proto;
    }
}
// This is pretty much the only way to get nice, extended Errors
// without using ES6
/**
 * This returns a new Error with a custom prototype. Note that it's _not_ a constructor
 *
 * @param message Error message
 *
 * **Example**
 *
 * ```js
 * throw EtaErr("template not found")
 * ```
 */
function EtaErr(message) {
    var err = new Error(message);
    setPrototypeOf(err, EtaErr.prototype);
    return err;
}
EtaErr.prototype = Object.create(Error.prototype, {
    name: { value: 'Eta Error', enumerable: false }
});
/**
 * Throws an EtaErr with a nicely formatted error and message showing where in the template the error occurred.
 */
function ParseErr(message, str, indx) {
    var whitespace = str.slice(0, indx).split(/\n/);
    var lineNo = whitespace.length;
    var colNo = whitespace[lineNo - 1].length + 1;
    message +=
        ' at line ' +
            lineNo +
            ' col ' +
            colNo +
            ':\n\n' +
            '  ' +
            str.split(/\n/)[lineNo - 1] +
            '\n' +
            '  ' +
            Array(colNo).join(' ') +
            '^';
    throw EtaErr(message);
}

/**
 * @returns The global Promise function
 */
var promiseImpl = new Function('return this')().Promise;
/**
 * @returns A new AsyncFunction constuctor
 */
function getAsyncFunctionConstructor() {
    try {
        return new Function('return (async function(){}).constructor')();
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            throw EtaErr("This environment doesn't support async/await");
        }
        else {
            throw e;
        }
    }
}
/**
 * str.trimLeft polyfill
 *
 * @param str - Input string
 * @returns The string with left whitespace removed
 *
 */
function trimLeft(str) {
    // eslint-disable-next-line no-extra-boolean-cast
    if (!!String.prototype.trimLeft) {
        return str.trimLeft();
    }
    else {
        return str.replace(/^\s+/, '');
    }
}
/**
 * str.trimRight polyfill
 *
 * @param str - Input string
 * @returns The string with right whitespace removed
 *
 */
function trimRight(str) {
    // eslint-disable-next-line no-extra-boolean-cast
    if (!!String.prototype.trimRight) {
        return str.trimRight();
    }
    else {
        return str.replace(/\s+$/, ''); // TODO: do we really need to replace BOM's?
    }
}

// TODO: allow '-' to trim up until newline. Use [^\S\n\r] instead of \s
/* END TYPES */
function hasOwnProp(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}
function copyProps(toObj, fromObj) {
    for (var key in fromObj) {
        if (hasOwnProp(fromObj, key)) {
            toObj[key] = fromObj[key];
        }
    }
    return toObj;
}
/**
 * Takes a string within a template and trims it, based on the preceding tag's whitespace control and `config.autoTrim`
 */
function trimWS(str, config, wsLeft, wsRight) {
    var leftTrim;
    var rightTrim;
    if (Array.isArray(config.autoTrim)) {
        // kinda confusing
        // but _}} will trim the left side of the following string
        leftTrim = config.autoTrim[1];
        rightTrim = config.autoTrim[0];
    }
    else {
        leftTrim = rightTrim = config.autoTrim;
    }
    if (wsLeft || wsLeft === false) {
        leftTrim = wsLeft;
    }
    if (wsRight || wsRight === false) {
        rightTrim = wsRight;
    }
    if (!rightTrim && !leftTrim) {
        return str;
    }
    if (leftTrim === 'slurp' && rightTrim === 'slurp') {
        return str.trim();
    }
    if (leftTrim === '_' || leftTrim === 'slurp') {
        // console.log('trimming left' + leftTrim)
        // full slurp
        str = trimLeft(str);
    }
    else if (leftTrim === '-' || leftTrim === 'nl') {
        // nl trim
        str = str.replace(/^(?:\r\n|\n|\r)/, '');
    }
    if (rightTrim === '_' || rightTrim === 'slurp') {
        // full slurp
        str = trimRight(str);
    }
    else if (rightTrim === '-' || rightTrim === 'nl') {
        // nl trim
        str = str.replace(/(?:\r\n|\n|\r)$/, ''); // TODO: make sure this gets \r\n
    }
    return str;
}
/**
 * A map of special HTML characters to their XML-escaped equivalents
 */
var escMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};
function replaceChar(s) {
    return escMap[s];
}
/**
 * XML-escapes an input value after converting it to a string
 *
 * @param str - Input value (usually a string)
 * @returns XML-escaped string
 */
function XMLEscape(str) {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    // To deal with XSS. Based on Escape implementations of Mustache.JS and Marko, then customized.
    var newStr = String(str);
    if (/[&<>"']/.test(newStr)) {
        return newStr.replace(/[&<>"']/g, replaceChar);
    }
    else {
        return newStr;
    }
}

/* END TYPES */
var templateLitReg = /`(?:\\[\s\S]|\${(?:[^{}]|{(?:[^{}]|{[^}]*})*})*}|(?!\${)[^\\`])*`/g;
var singleQuoteReg = /'(?:\\[\s\w"'\\`]|[^\n\r'\\])*?'/g;
var doubleQuoteReg = /"(?:\\[\s\w"'\\`]|[^\n\r"\\])*?"/g;
/** Escape special regular expression characters inside a string */
function escapeRegExp(string) {
    // From MDN
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function parse(str, config) {
    var buffer = [];
    var trimLeftOfNextStr = false;
    var lastIndex = 0;
    var parseOptions = config.parse;
    if (config.plugins) {
        for (var i = 0; i < config.plugins.length; i++) {
            var plugin = config.plugins[i];
            if (plugin.processTemplate) {
                str = plugin.processTemplate(str, config);
            }
        }
    }
    /* Adding for EJS compatibility */
    if (config.rmWhitespace) {
        // Code taken directly from EJS
        // Have to use two separate replaces here as `^` and `$` operators don't
        // work well with `\r` and empty lines don't work well with the `m` flag.
        // Essentially, this replaces the whitespace at the beginning and end of
        // each line and removes multiple newlines.
        str = str.replace(/[\r\n]+/g, '\n').replace(/^\s+|\s+$/gm, '');
    }
    /* End rmWhitespace option */
    templateLitReg.lastIndex = 0;
    singleQuoteReg.lastIndex = 0;
    doubleQuoteReg.lastIndex = 0;
    function pushString(strng, shouldTrimRightOfString) {
        if (strng) {
            // if string is truthy it must be of type 'string'
            strng = trimWS(strng, config, trimLeftOfNextStr, // this will only be false on the first str, the next ones will be null or undefined
            shouldTrimRightOfString);
            if (strng) {
                // replace \ with \\, ' with \'
                // we're going to convert all CRLF to LF so it doesn't take more than one replace
                strng = strng.replace(/\\|'/g, '\\$&').replace(/\r\n|\n|\r/g, '\\n');
                buffer.push(strng);
            }
        }
    }
    var prefixes = [parseOptions.exec, parseOptions.interpolate, parseOptions.raw].reduce(function (accumulator, prefix) {
        if (accumulator && prefix) {
            return accumulator + '|' + escapeRegExp(prefix);
        }
        else if (prefix) {
            // accumulator is falsy
            return escapeRegExp(prefix);
        }
        else {
            // prefix and accumulator are both falsy
            return accumulator;
        }
    }, '');
    var parseOpenReg = new RegExp('([^]*?)' + escapeRegExp(config.tags[0]) + '(-|_)?\\s*(' + prefixes + ')?\\s*', 'g');
    var parseCloseReg = new RegExp('\'|"|`|\\/\\*|(\\s*(-|_)?' + escapeRegExp(config.tags[1]) + ')', 'g');
    // TODO: benchmark having the \s* on either side vs using str.trim()
    var m;
    while ((m = parseOpenReg.exec(str))) {
        lastIndex = m[0].length + m.index;
        var precedingString = m[1];
        var wsLeft = m[2];
        var prefix = m[3] || ''; // by default either ~, =, or empty
        pushString(precedingString, wsLeft);
        parseCloseReg.lastIndex = lastIndex;
        var closeTag = void 0;
        var currentObj = false;
        while ((closeTag = parseCloseReg.exec(str))) {
            if (closeTag[1]) {
                var content = str.slice(lastIndex, closeTag.index);
                parseOpenReg.lastIndex = lastIndex = parseCloseReg.lastIndex;
                trimLeftOfNextStr = closeTag[2];
                var currentType = prefix === parseOptions.exec
                    ? 'e'
                    : prefix === parseOptions.raw
                        ? 'r'
                        : prefix === parseOptions.interpolate
                            ? 'i'
                            : '';
                currentObj = { t: currentType, val: content };
                break;
            }
            else {
                var char = closeTag[0];
                if (char === '/*') {
                    var commentCloseInd = str.indexOf('*/', parseCloseReg.lastIndex);
                    if (commentCloseInd === -1) {
                        ParseErr('unclosed comment', str, closeTag.index);
                    }
                    parseCloseReg.lastIndex = commentCloseInd;
                }
                else if (char === "'") {
                    singleQuoteReg.lastIndex = closeTag.index;
                    var singleQuoteMatch = singleQuoteReg.exec(str);
                    if (singleQuoteMatch) {
                        parseCloseReg.lastIndex = singleQuoteReg.lastIndex;
                    }
                    else {
                        ParseErr('unclosed string', str, closeTag.index);
                    }
                }
                else if (char === '"') {
                    doubleQuoteReg.lastIndex = closeTag.index;
                    var doubleQuoteMatch = doubleQuoteReg.exec(str);
                    if (doubleQuoteMatch) {
                        parseCloseReg.lastIndex = doubleQuoteReg.lastIndex;
                    }
                    else {
                        ParseErr('unclosed string', str, closeTag.index);
                    }
                }
                else if (char === '`') {
                    templateLitReg.lastIndex = closeTag.index;
                    var templateLitMatch = templateLitReg.exec(str);
                    if (templateLitMatch) {
                        parseCloseReg.lastIndex = templateLitReg.lastIndex;
                    }
                    else {
                        ParseErr('unclosed string', str, closeTag.index);
                    }
                }
            }
        }
        if (currentObj) {
            buffer.push(currentObj);
        }
        else {
            ParseErr('unclosed tag', str, m.index + precedingString.length);
        }
    }
    pushString(str.slice(lastIndex, str.length), false);
    if (config.plugins) {
        for (var i = 0; i < config.plugins.length; i++) {
            var plugin = config.plugins[i];
            if (plugin.processAST) {
                buffer = plugin.processAST(buffer, config);
            }
        }
    }
    return buffer;
}

/* END TYPES */
/**
 * Compiles a template string to a function string. Most often users just use `compile()`, which calls `compileToString` and creates a new function using the result
 *
 * **Example**
 *
 * ```js
 * compileToString("Hi <%= it.user %>", eta.config)
 * // "var tR='',include=E.include.bind(E),includeFile=E.includeFile.bind(E);tR+='Hi ';tR+=E.e(it.user);if(cb){cb(null,tR)} return tR"
 * ```
 */
function compileToString(str, config) {
    var buffer = parse(str, config);
    var res = "var tR='',__l,__lP" +
        (config.include ? ',include=E.include.bind(E)' : '') +
        (config.includeFile ? ',includeFile=E.includeFile.bind(E)' : '') +
        '\nfunction layout(p,d){__l=p;__lP=d}\n' +
        (config.globalAwait ? 'let _prs = [];\n' : '') +
        (config.useWith ? 'with(' + config.varName + '||{}){' : '') +
        compileScope(buffer, config) +
        (config.includeFile
            ? 'if(__l)tR=' +
                (config.async ? 'await ' : '') +
                ("includeFile(__l,Object.assign(" + config.varName + ",{body:tR},__lP))\n")
            : config.include
                ? 'if(__l)tR=' +
                    (config.async ? 'await ' : '') +
                    ("include(__l,Object.assign(" + config.varName + ",{body:tR},__lP))\n")
                : '') +
        'if(cb){cb(null,tR)} return tR' +
        (config.useWith ? '}' : '');
    if (config.plugins) {
        for (var i = 0; i < config.plugins.length; i++) {
            var plugin = config.plugins[i];
            if (plugin.processFnString) {
                res = plugin.processFnString(res, config);
            }
        }
    }
    return res;
}
/**
 * Loops through the AST generated by `parse` and transform each item into JS calls
 *
 * **Example**
 *
 * ```js
 * // AST version of 'Hi <%= it.user %>'
 * let templateAST = ['Hi ', { val: 'it.user', t: 'i' }]
 * compileScope(templateAST, eta.config)
 * // "tR+='Hi ';tR+=E.e(it.user);"
 * ```
 */
function compileScope(buff, config) {
    var i;
    var buffLength = buff.length;
    var returnStr = '';
    if (config.globalAwait) {
        for (i = 0; i < buffLength; i++) {
            var currentBlock = buff[i];
            if (typeof currentBlock !== 'string') {
                var type = currentBlock.t;
                if (type === 'r' || type === 'i') {
                    var content = currentBlock.val || '';
                    returnStr += "_prs.push(" + content + ");\n";
                }
            }
        }
        returnStr += 'let _rst = await Promise.all(_prs);\n';
    }
    var j = 0;
    for (i = 0; i < buffLength; i++) {
        var currentBlock = buff[i];
        if (typeof currentBlock === 'string') {
            var str = currentBlock;
            // we know string exists
            returnStr += "tR+='" + str + "'\n";
        }
        else {
            var type = currentBlock.t; // ~, s, !, ?, r
            var content = currentBlock.val || '';
            if (type === 'r') {
                // raw
                if (config.globalAwait) {
                    content = "_rst[" + j + "]";
                }
                if (config.filter) {
                    content = 'E.filter(' + content + ')';
                }
                returnStr += 'tR+=' + content + '\n';
                j++;
            }
            else if (type === 'i') {
                // interpolate
                if (config.globalAwait) {
                    content = "_rst[" + j + "]";
                }
                if (config.filter) {
                    content = 'E.filter(' + content + ')';
                }
                if (config.autoEscape) {
                    content = 'E.e(' + content + ')';
                }
                returnStr += 'tR+=' + content + '\n';
                j++;
                // reference
            }
            else if (type === 'e') {
                // execute
                returnStr += content + '\n'; // you need a \n in case you have <% } %>
            }
        }
    }
    return returnStr;
}

/**
 * Handles storage and accessing of values
 *
 * In this case, we use it to store compiled template functions
 * Indexed by their `name` or `filename`
 */
var Cacher = /** @class */ (function () {
    function Cacher(cache) {
        this.cache = cache;
    }
    Cacher.prototype.define = function (key, val) {
        this.cache[key] = val;
    };
    Cacher.prototype.get = function (key) {
        // string | array.
        // TODO: allow array of keys to look down
        // TODO: create plugin to allow referencing helpers, filters with dot notation
        return this.cache[key];
    };
    Cacher.prototype.remove = function (key) {
        delete this.cache[key];
    };
    Cacher.prototype.reset = function () {
        this.cache = {};
    };
    Cacher.prototype.load = function (cacheObj) {
        copyProps(this.cache, cacheObj);
    };
    return Cacher;
}());

/* END TYPES */
/**
 * Eta's template storage
 *
 * Stores partials and cached templates
 */
var templates = new Cacher({});

/* END TYPES */
/**
 * Include a template based on its name (or filepath, if it's already been cached).
 *
 * Called like `include(templateNameOrPath, data)`
 */
function includeHelper(templateNameOrPath, data) {
    var template = this.templates.get(templateNameOrPath);
    if (!template) {
        throw EtaErr('Could not fetch template "' + templateNameOrPath + '"');
    }
    return template(data, this);
}
/** Eta's base (global) configuration */
var config = {
    async: false,
    autoEscape: true,
    autoTrim: [false, 'nl'],
    cache: false,
    e: XMLEscape,
    include: includeHelper,
    parse: {
        exec: '',
        interpolate: '=',
        raw: '~'
    },
    plugins: [],
    rmWhitespace: false,
    tags: ['<%', '%>'],
    templates: templates,
    useWith: false,
    varName: 'it'
};
/**
 * Takes one or two partial (not necessarily complete) configuration objects, merges them 1 layer deep into eta.config, and returns the result
 *
 * @param override Partial configuration object
 * @param baseConfig Partial configuration object to merge before `override`
 *
 * **Example**
 *
 * ```js
 * let customConfig = getConfig({tags: ['!#', '#!']})
 * ```
 */
function getConfig(override, baseConfig) {
    // TODO: run more tests on this
    var res = {}; // Linked
    copyProps(res, config); // Creates deep clone of eta.config, 1 layer deep
    if (baseConfig) {
        copyProps(res, baseConfig);
    }
    if (override) {
        copyProps(res, override);
    }
    return res;
}

/* END TYPES */
/**
 * Takes a template string and returns a template function that can be called with (data, config, [cb])
 *
 * @param str - The template string
 * @param config - A custom configuration object (optional)
 *
 * **Example**
 *
 * ```js
 * let compiledFn = eta.compile("Hi <%= it.user %>")
 * // function anonymous()
 * let compiledFnStr = compiledFn.toString()
 * // "function anonymous(it,E,cb\n) {\nvar tR='',include=E.include.bind(E),includeFile=E.includeFile.bind(E);tR+='Hi ';tR+=E.e(it.user);if(cb){cb(null,tR)} return tR\n}"
 * ```
 */
function compile(str, config) {
    var options = getConfig(config || {});
    /* ASYNC HANDLING */
    // The below code is modified from mde/ejs. All credit should go to them.
    var ctor = options.async ? getAsyncFunctionConstructor() : Function;
    /* END ASYNC HANDLING */
    try {
        return new ctor(options.varName, 'E', // EtaConfig
        'cb', // optional callback
        compileToString(str, options)); // eslint-disable-line no-new-func
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            throw EtaErr('Bad template syntax\n\n' +
                e.message +
                '\n' +
                Array(e.message.length + 1).join('=') +
                '\n' +
                compileToString(str, options) +
                '\n' // This will put an extra newline before the callstack for extra readability
            );
        }
        else {
            throw e;
        }
    }
}

var _BOM = /^\uFEFF/;
/* END TYPES */
/**
 * Get the path to the included file from the parent file path and the
 * specified path.
 *
 * If `name` does not have an extension, it will default to `.eta`
 *
 * @param name specified path
 * @param parentfile parent file path
 * @param isDirectory whether parentfile is a directory
 * @return absolute path to template
 */
function getWholeFilePath(name, parentfile, isDirectory) {
    var includePath = path__namespace.resolve(isDirectory ? parentfile : path__namespace.dirname(parentfile), // returns directory the parent file is in
    name // file
    ) + (path__namespace.extname(name) ? '' : '.eta');
    return includePath;
}
/**
 * Get the absolute path to an included template
 *
 * If this is called with an absolute path (for example, starting with '/' or 'C:\')
 * then Eta will attempt to resolve the absolute path within options.views. If it cannot,
 * Eta will fallback to options.root or '/'
 *
 * If this is called with a relative path, Eta will:
 * - Look relative to the current template (if the current template has the `filename` property)
 * - Look inside each directory in options.views
 *
 * Note: if Eta is unable to find a template using path and options, it will throw an error.
 *
 * @param path    specified path
 * @param options compilation options
 * @return absolute path to template
 */
function getPath(path, options) {
    var includePath = false;
    var views = options.views;
    var searchedPaths = [];
    // If these four values are the same,
    // getPath() will return the same result every time.
    // We can cache the result to avoid expensive
    // file operations.
    var pathOptions = JSON.stringify({
        filename: options.filename,
        path: path,
        root: options.root,
        views: options.views
    });
    if (options.cache && options.filepathCache && options.filepathCache[pathOptions]) {
        // Use the cached filepath
        return options.filepathCache[pathOptions];
    }
    /** Add a filepath to the list of paths we've checked for a template */
    function addPathToSearched(pathSearched) {
        if (!searchedPaths.includes(pathSearched)) {
            searchedPaths.push(pathSearched);
        }
    }
    /**
     * Take a filepath (like 'partials/mypartial.eta'). Attempt to find the template file inside `views`;
     * return the resulting template file path, or `false` to indicate that the template was not found.
     *
     * @param views the filepath that holds templates, or an array of filepaths that hold templates
     * @param path the path to the template
     */
    function searchViews(views, path) {
        var filePath;
        // If views is an array, then loop through each directory
        // And attempt to find the template
        if (Array.isArray(views) &&
            views.some(function (v) {
                filePath = getWholeFilePath(path, v, true);
                addPathToSearched(filePath);
                return fs.existsSync(filePath);
            })) {
            // If the above returned true, we know that the filePath was just set to a path
            // That exists (Array.some() returns as soon as it finds a valid element)
            return filePath;
        }
        else if (typeof views === 'string') {
            // Search for the file if views is a single directory
            filePath = getWholeFilePath(path, views, true);
            addPathToSearched(filePath);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }
        // Unable to find a file
        return false;
    }
    // Path starts with '/', 'C:\', etc.
    var match = /^[A-Za-z]+:\\|^\//.exec(path);
    // Absolute path, like /partials/partial.eta
    if (match && match.length) {
        // We have to trim the beginning '/' off the path, or else
        // path.resolve(dir, path) will always resolve to just path
        var formattedPath = path.replace(/^\/*/, '');
        // First, try to resolve the path within options.views
        includePath = searchViews(views, formattedPath);
        if (!includePath) {
            // If that fails, searchViews will return false. Try to find the path
            // inside options.root (by default '/', the base of the filesystem)
            var pathFromRoot = getWholeFilePath(formattedPath, options.root || '/', true);
            addPathToSearched(pathFromRoot);
            includePath = pathFromRoot;
        }
    }
    else {
        // Relative paths
        // Look relative to a passed filename first
        if (options.filename) {
            var filePath = getWholeFilePath(path, options.filename);
            addPathToSearched(filePath);
            if (fs.existsSync(filePath)) {
                includePath = filePath;
            }
        }
        // Then look for the template in options.views
        if (!includePath) {
            includePath = searchViews(views, path);
        }
        if (!includePath) {
            throw EtaErr('Could not find the template "' + path + '". Paths tried: ' + searchedPaths);
        }
    }
    // If caching and filepathCache are enabled,
    // cache the input & output of this function.
    if (options.cache && options.filepathCache) {
        options.filepathCache[pathOptions] = includePath;
    }
    return includePath;
}
/**
 * Reads a file synchronously
 */
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath).toString().replace(_BOM, ''); // TODO: is replacing BOM's necessary?
    }
    catch (_a) {
        throw EtaErr("Failed to read template at '" + filePath + "'");
    }
}

// express is set like: app.engine('html', require('eta').renderFile)
/* END TYPES */
/**
 * Reads a template, compiles it into a function, caches it if caching isn't disabled, returns the function
 *
 * @param filePath Absolute path to template file
 * @param options Eta configuration overrides
 * @param noCache Optionally, make Eta not cache the template
 */
function loadFile(filePath, options, noCache) {
    var config = getConfig(options);
    var template = readFile(filePath);
    try {
        var compiledTemplate = compile(template, config);
        if (!noCache) {
            config.templates.define(config.filename, compiledTemplate);
        }
        return compiledTemplate;
    }
    catch (e) {
        throw EtaErr('Loading file: ' + filePath + ' failed:\n\n' + e.message);
    }
}
/**
 * Get the template from a string or a file, either compiled on-the-fly or
 * read from cache (if enabled), and cache the template if needed.
 *
 * If `options.cache` is true, this function reads the file from
 * `options.filename` so it must be set prior to calling this function.
 *
 * @param options   compilation options
 * @return Eta template function
 */
function handleCache$1(options) {
    var filename = options.filename;
    if (options.cache) {
        var func = options.templates.get(filename);
        if (func) {
            return func;
        }
        return loadFile(filename, options);
    }
    // Caching is disabled, so pass noCache = true
    return loadFile(filename, options, true);
}
/**
 * Get the template function.
 *
 * If `options.cache` is `true`, then the template is cached.
 *
 * This returns a template function and the config object with which that template function should be called.
 *
 * @remarks
 *
 * It's important that this returns a config object with `filename` set.
 * Otherwise, the included file would not be able to use relative paths
 *
 * @param path path for the specified file (if relative, specify `views` on `options`)
 * @param options compilation options
 * @return [Eta template function, new config object]
 */
function includeFile(path, options) {
    // the below creates a new options object, using the parent filepath of the old options object and the path
    var newFileOptions = getConfig({ filename: getPath(path, options) }, options);
    // TODO: make sure properties are currectly copied over
    return [handleCache$1(newFileOptions), newFileOptions];
}

/* END TYPES */
/**
 * Called with `includeFile(path, data)`
 */
function includeFileHelper(path, data) {
    var templateAndConfig = includeFile(path, this);
    return templateAndConfig[0](data, templateAndConfig[1]);
}

/* END TYPES */
function handleCache(template, options) {
    if (options.cache && options.name && options.templates.get(options.name)) {
        return options.templates.get(options.name);
    }
    var templateFunc = typeof template === 'function' ? template : compile(template, options);
    // Note that we don't have to check if it already exists in the cache;
    // it would have returned earlier if it had
    if (options.cache && options.name) {
        options.templates.define(options.name, templateFunc);
    }
    return templateFunc;
}
/**
 * Render a template
 *
 * If `template` is a string, Eta will compile it to a function and then call it with the provided data.
 * If `template` is a template function, Eta will call it with the provided data.
 *
 * If `config.async` is `false`, Eta will return the rendered template.
 *
 * If `config.async` is `true` and there's a callback function, Eta will call the callback with `(err, renderedTemplate)`.
 * If `config.async` is `true` and there's not a callback function, Eta will return a Promise that resolves to the rendered template.
 *
 * If `config.cache` is `true` and `config` has a `name` or `filename` property, Eta will cache the template on the first render and use the cached template for all subsequent renders.
 *
 * @param template Template string or template function
 * @param data Data to render the template with
 * @param config Optional config options
 * @param cb Callback function
 */
function render(template, data, config, cb) {
    var options = getConfig(config || {});
    if (options.async) {
        if (cb) {
            // If user passes callback
            try {
                // Note: if there is an error while rendering the template,
                // It will bubble up and be caught here
                var templateFn = handleCache(template, options);
                templateFn(data, options, cb);
            }
            catch (err) {
                return cb(err);
            }
        }
        else {
            // No callback, try returning a promise
            if (typeof promiseImpl === 'function') {
                return new promiseImpl(function (resolve, reject) {
                    try {
                        resolve(handleCache(template, options)(data, options));
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            }
            else {
                throw EtaErr("Please provide a callback function, this env doesn't support Promises");
            }
        }
    }
    else {
        return handleCache(template, options)(data, options);
    }
}
/**
 * Render a template asynchronously
 *
 * If `template` is a string, Eta will compile it to a function and call it with the provided data.
 * If `template` is a function, Eta will call it with the provided data.
 *
 * If there is a callback function, Eta will call it with `(err, renderedTemplate)`.
 * If there is not a callback function, Eta will return a Promise that resolves to the rendered template
 *
 * @param template Template string or template function
 * @param data Data to render the template with
 * @param config Optional config options
 * @param cb Callback function
 */
function renderAsync(template, data, config, cb) {
    // Using Object.assign to lower bundle size, using spread operator makes it larger because of typescript injected polyfills
    return render(template, data, Object.assign({}, config, { async: true }), cb);
}

// @denoify-ignore
config.includeFile = includeFileHelper;
config.filepathCache = {};

class TParser {
    constructor(app) {
        this.app = app;
    }
}

class InternalModule extends TParser {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.static_templates = new Map();
        this.dynamic_templates = new Map();
    }
    getName() {
        return this.name;
    }
    generateContext(file) {
        return __awaiter(this, void 0, void 0, function* () {
            this.file = file;
            if (this.static_templates.size === 0) {
                yield this.createStaticTemplates();
            }
            yield this.updateTemplates();
            return Object.assign(Object.assign({}, Object.fromEntries(this.static_templates)), Object.fromEntries(this.dynamic_templates));
        });
    }
}

class InternalModuleDate extends InternalModule {
    constructor() {
        super(...arguments);
        this.name = "date";
    }
    createStaticTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            this.static_templates.set("now", this.generate_now());
            this.static_templates.set("tomorrow", this.generate_tomorrow());
            this.static_templates.set("weekday", this.generate_weekday());
            this.static_templates.set("yesterday", this.generate_yesterday());
        });
    }
    updateTemplates() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    generate_now() {
        return (format = "YYYY-MM-DD", offset, reference, reference_format) => {
            if (reference && !window.moment(reference, reference_format).isValid()) {
                throw new Error("Invalid reference date format, try specifying one with the argument 'reference_format'");
            }
            let duration;
            if (typeof offset === "string") {
                duration = window.moment.duration(offset);
            }
            else if (typeof offset === "number") {
                duration = window.moment.duration(offset, "days");
            }
            return window.moment(reference, reference_format).add(duration).format(format);
        };
    }
    generate_tomorrow() {
        return (format = "YYYY-MM-DD") => {
            return window.moment().add(1, 'days').format(format);
        };
    }
    generate_weekday() {
        return (format = "YYYY-MM-DD", weekday, reference, reference_format) => {
            if (reference && !window.moment(reference, reference_format).isValid()) {
                throw new Error("Invalid reference date format, try specifying one with the argument 'reference_format'");
            }
            return window.moment(reference, reference_format).weekday(weekday).format(format);
        };
    }
    generate_yesterday() {
        return (format = "YYYY-MM-DD") => {
            return window.moment().add(-1, 'days').format(format);
        };
    }
}

const UNSUPPORTED_MOBILE_TEMPLATE = "Error_MobileUnsupportedTemplate";
const ICON_DATA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 51.1328 28.7"><path d="M0 15.14 0 10.15 18.67 1.51 18.67 6.03 4.72 12.33 4.72 12.76 18.67 19.22 18.67 23.74 0 15.14ZM33.6928 1.84C33.6928 1.84 33.9761 2.1467 34.5428 2.76C35.1094 3.38 35.3928 4.56 35.3928 6.3C35.3928 8.0466 34.8195 9.54 33.6728 10.78C32.5261 12.02 31.0995 12.64 29.3928 12.64C27.6862 12.64 26.2661 12.0267 25.1328 10.8C23.9928 9.5733 23.4228 8.0867 23.4228 6.34C23.4228 4.6 23.9995 3.1066 25.1528 1.86C26.2994.62 27.7261 0 29.4328 0C31.1395 0 32.5594.6133 33.6928 1.84M49.8228.67 29.5328 28.38 24.4128 28.38 44.7128.67 49.8228.67M31.0328 8.38C31.0328 8.38 31.1395 8.2467 31.3528 7.98C31.5662 7.7067 31.6728 7.1733 31.6728 6.38C31.6728 5.5867 31.4461 4.92 30.9928 4.38C30.5461 3.84 29.9995 3.57 29.3528 3.57C28.7061 3.57 28.1695 3.84 27.7428 4.38C27.3228 4.92 27.1128 5.5867 27.1128 6.38C27.1128 7.1733 27.3361 7.84 27.7828 8.38C28.2361 8.9267 28.7861 9.2 29.4328 9.2C30.0795 9.2 30.6128 8.9267 31.0328 8.38M49.4328 17.9C49.4328 17.9 49.7161 18.2067 50.2828 18.82C50.8495 19.4333 51.1328 20.6133 51.1328 22.36C51.1328 24.1 50.5594 25.59 49.4128 26.83C48.2595 28.0766 46.8295 28.7 45.1228 28.7C43.4228 28.7 42.0028 28.0833 40.8628 26.85C39.7295 25.6233 39.1628 24.1366 39.1628 22.39C39.1628 20.65 39.7361 19.16 40.8828 17.92C42.0361 16.6733 43.4628 16.05 45.1628 16.05C46.8694 16.05 48.2928 16.6667 49.4328 17.9M46.8528 24.52C46.8528 24.52 46.9595 24.3833 47.1728 24.11C47.3795 23.8367 47.4828 23.3033 47.4828 22.51C47.4828 21.7167 47.2595 21.05 46.8128 20.51C46.3661 19.97 45.8162 19.7 45.1628 19.7C44.5161 19.7 43.9828 19.97 43.5628 20.51C43.1428 21.05 42.9328 21.7167 42.9328 22.51C42.9328 23.3033 43.1561 23.9733 43.6028 24.52C44.0494 25.06 44.5961 25.33 45.2428 25.33C45.8895 25.33 46.4261 25.06 46.8528 24.52Z" fill="currentColor"/></svg>`;

const DEPTH_LIMIT = 10;
class InternalModuleFile extends InternalModule {
    constructor() {
        super(...arguments);
        this.name = "file";
        this.include_depth = 0;
    }
    createStaticTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Remove this
            this.static_templates.set("clipboard", this.generate_clipboard());
            this.static_templates.set("cursor", this.generate_cursor());
            this.static_templates.set("selection", this.generate_selection());
        });
    }
    updateTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            this.dynamic_templates.set("content", yield this.generate_content());
            this.dynamic_templates.set("creation_date", this.generate_creation_date());
            this.dynamic_templates.set("folder", this.generate_folder());
            this.dynamic_templates.set("include", this.generate_include());
            this.dynamic_templates.set("last_modified_date", this.generate_last_modified_date());
            this.dynamic_templates.set("path", this.generate_path());
            this.dynamic_templates.set("rename", this.generate_rename());
            this.dynamic_templates.set("tags", this.generate_tags());
            this.dynamic_templates.set("title", this.generate_title());
        });
    }
    generate_clipboard() {
        return () => {
            // TODO: Remove this
            this.plugin.log_update("tp.file.clipboard was moved to a new module: System Module!<br/> You must now use tp.system.clipboard()");
            return "";
        };
    }
    generate_cursor() {
        return (order) => {
            // Hack to prevent empty output
            return `<% tp.file.cursor(${order !== null && order !== void 0 ? order : ''}) %>`;
        };
    }
    generate_content() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.app.vault.read(this.file);
        });
    }
    generate_creation_date() {
        return (format = "YYYY-MM-DD HH:mm") => {
            return window.moment(this.file.stat.ctime).format(format);
        };
    }
    generate_folder() {
        return (relative = false) => {
            let parent = this.file.parent;
            let folder;
            if (relative) {
                folder = parent.path;
            }
            else {
                folder = parent.name;
            }
            return folder;
        };
    }
    generate_include() {
        return (include_filename) => __awaiter(this, void 0, void 0, function* () {
            let inc_file = this.app.metadataCache.getFirstLinkpathDest(obsidian.normalizePath(include_filename), "");
            if (!inc_file) {
                throw new Error(`File ${include_filename} doesn't exist`);
            }
            if (!(inc_file instanceof obsidian.TFile)) {
                throw new Error(`${include_filename} is a folder, not a file`);
            }
            // TODO: Add mutex for this, this may currently lead to a race condition. 
            // While not very impactful, that could still be annoying.
            this.include_depth += 1;
            if (this.include_depth > DEPTH_LIMIT) {
                this.include_depth = 0;
                throw new Error("Reached inclusion depth limit (max = 10)");
            }
            let inc_file_content = yield this.app.vault.read(inc_file);
            let parsed_content = yield this.plugin.parser.parseTemplates(inc_file_content);
            this.include_depth -= 1;
            return parsed_content;
        });
    }
    generate_last_modified_date() {
        return (format = "YYYY-MM-DD HH:mm") => {
            return window.moment(this.file.stat.mtime).format(format);
        };
    }
    generate_path() {
        return (relative = false) => {
            // TODO: Add mobile support
            if (this.app.isMobile) {
                return UNSUPPORTED_MOBILE_TEMPLATE;
            }
            if (!(this.app.vault.adapter instanceof obsidian.FileSystemAdapter)) {
                throw new Error("app.vault is not a FileSystemAdapter instance");
            }
            let vault_path = this.app.vault.adapter.getBasePath();
            if (relative) {
                return this.file.path;
            }
            else {
                return `${vault_path}/${this.file.path}`;
            }
        };
    }
    generate_rename() {
        return (new_title) => __awaiter(this, void 0, void 0, function* () {
            let new_path = obsidian.normalizePath(`${this.file.parent.path}/${new_title}.${this.file.extension}`);
            yield this.app.fileManager.renameFile(this.file, new_path);
            return "";
        });
    }
    generate_selection() {
        return () => {
            let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (active_view == null) {
                throw new Error("Active view is null, can't read selection.");
            }
            let editor = active_view.editor;
            return editor.getSelection();
        };
    }
    generate_tags() {
        let cache = this.app.metadataCache.getFileCache(this.file);
        return obsidian.getAllTags(cache);
    }
    generate_title() {
        return this.file.basename;
    }
}

class InternalModuleWeb extends InternalModule {
    constructor() {
        super(...arguments);
        this.name = "web";
    }
    createStaticTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            this.static_templates.set("daily_quote", this.generate_daily_quote());
            this.static_templates.set("random_picture", this.generate_random_picture());
            this.static_templates.set("get_request", this.generate_get_request());
        });
    }
    updateTemplates() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    getRequest(url) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield fetch(url);
            if (!response.ok) {
                throw new Error("Error performing GET request");
            }
            return response;
        });
    }
    generate_daily_quote() {
        return () => __awaiter(this, void 0, void 0, function* () {
            let response = yield this.getRequest("https://quotes.rest/qod");
            let json = yield response.json();
            let author = json.contents.quotes[0].author;
            let quote = json.contents.quotes[0].quote;
            let new_content = `> ${quote}\n> &mdash; <cite>${author}</cite>`;
            return new_content;
        });
    }
    generate_random_picture() {
        return (size, query) => __awaiter(this, void 0, void 0, function* () {
            let response = yield this.getRequest(`https://source.unsplash.com/random/${size !== null && size !== void 0 ? size : ''}?${query !== null && query !== void 0 ? query : ''}`);
            let url = response.url;
            return `![tp.web.random_picture](${url})`;
        });
    }
    generate_get_request() {
        return (url) => __awaiter(this, void 0, void 0, function* () {
            let response = yield this.getRequest(url);
            let json = yield response.json();
            return json;
        });
    }
}

class InternalModuleFrontmatter extends InternalModule {
    constructor() {
        super(...arguments);
        this.name = "frontmatter";
    }
    createStaticTemplates() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    updateTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            let cache = this.app.metadataCache.getFileCache(this.file);
            this.dynamic_templates = new Map(Object.entries((cache === null || cache === void 0 ? void 0 : cache.frontmatter) || {}));
        });
    }
}

class PromptModal extends obsidian.Modal {
    constructor(app, prompt_text, default_value) {
        super(app);
        this.prompt_text = prompt_text;
        this.default_value = default_value;
    }
    onOpen() {
        this.titleEl.setText(this.prompt_text);
        this.createForm();
    }
    onClose() {
        this.contentEl.empty();
    }
    createForm() {
        var _a;
        let div = this.contentEl.createDiv();
        div.addClass("templater-prompt-div");
        let form = div.createEl("form");
        form.addClass("templater-prompt-form");
        form.type = "submit";
        form.onsubmit = (e) => {
            e.preventDefault();
            this.cb(this.promptEl.value);
            this.close();
        };
        this.promptEl = form.createEl("input");
        this.promptEl.type = "text";
        this.promptEl.placeholder = "Type text here...";
        this.promptEl.value = (_a = this.default_value) !== null && _a !== void 0 ? _a : "";
        this.promptEl.addClass("templater-prompt-input");
        this.promptEl.select();
    }
    openAndGetValue(cb) {
        return __awaiter(this, void 0, void 0, function* () {
            this.cb = cb;
            this.open();
        });
    }
}

class InternalModuleSystem extends InternalModule {
    constructor() {
        super(...arguments);
        this.name = "system";
    }
    createStaticTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            this.static_templates.set("clipboard", this.generate_clipboard());
            this.static_templates.set("prompt", this.generate_prompt());
        });
    }
    updateTemplates() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    generate_clipboard() {
        return () => __awaiter(this, void 0, void 0, function* () {
            // TODO: Add mobile support
            if (this.app.isMobile) {
                return UNSUPPORTED_MOBILE_TEMPLATE;
            }
            return yield navigator.clipboard.readText();
        });
    }
    generate_prompt() {
        return (prompt_text, default_value) => {
            let prompt = new PromptModal(this.app, prompt_text, default_value);
            return new Promise((resolve) => prompt.openAndGetValue(resolve));
        };
    }
}

class InternalTemplateParser extends TParser {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.modules_array = new Array();
        this.createModules();
    }
    createModules() {
        this.modules_array.push(new InternalModuleDate(this.app, this.plugin));
        this.modules_array.push(new InternalModuleFile(this.app, this.plugin));
        this.modules_array.push(new InternalModuleWeb(this.app, this.plugin));
        this.modules_array.push(new InternalModuleFrontmatter(this.app, this.plugin));
        this.modules_array.push(new InternalModuleSystem(this.app, this.plugin));
    }
    generateContext(f) {
        return __awaiter(this, void 0, void 0, function* () {
            let modules_context_map = new Map();
            for (let mod of this.modules_array) {
                modules_context_map.set(mod.getName(), yield mod.generateContext(f));
            }
            return Object.fromEntries(modules_context_map);
        });
    }
}

class UserTemplateParser extends TParser {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.resolveCwd();
    }
    resolveCwd() {
        // TODO: Add mobile support
        if (this.app.isMobile || !(this.app.vault.adapter instanceof obsidian.FileSystemAdapter)) {
            this.cwd = "";
        }
        else {
            this.cwd = this.app.vault.adapter.getBasePath();
        }
    }
    generateUserTemplates(file) {
        return __awaiter(this, void 0, void 0, function* () {
            let user_templates = new Map();
            const exec_promise = util.promisify(child_process.exec);
            let context = yield this.plugin.parser.generateContext(file, ContextMode.INTERNAL);
            for (let [template, cmd] of this.plugin.settings.templates_pairs) {
                if (template === "" || cmd === "") {
                    continue;
                }
                cmd = yield this.plugin.parser.parseTemplates(cmd, context);
                user_templates.set(template, (user_args) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        let process_env = Object.assign(Object.assign({}, process.env), user_args);
                        let cmd_options = {
                            timeout: this.plugin.settings.command_timeout * 1000,
                            cwd: this.cwd,
                            env: process_env,
                        };
                        let { stdout } = yield exec_promise(cmd, cmd_options);
                        return stdout.trimRight();
                    }
                    catch (error) {
                        this.plugin.log_error(`Error with User Template ${template}`, error);
                    }
                }));
            }
            return user_templates;
        });
    }
    generateContext(file) {
        return __awaiter(this, void 0, void 0, function* () {
            let user_templates = yield this.generateUserTemplates(file);
            return Object.fromEntries(user_templates);
        });
    }
}

class CursorJumper {
    constructor(app) {
        this.app = app;
        this.cursor_regex = new RegExp("<%\\s*tp.file.cursor\\((?<order>[0-9]{0,2})\\)\\s*%>", "g");
    }
    get_editor_position_from_index(content, index) {
        let substr = content.substr(0, index);
        let l = 0;
        let offset = -1;
        let r = -1;
        for (; (r = substr.indexOf("\n", r + 1)) !== -1; l++, offset = r)
            ;
        offset += 1;
        let ch = content.substr(offset, index - offset).length;
        return { line: l, ch: ch };
    }
    jump_to_next_cursor_location() {
        return __awaiter(this, void 0, void 0, function* () {
            let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (active_view === null) {
                throw new Error("No active view, can't append templates.");
            }
            let active_file = active_view.file;
            yield active_view.save();
            let content = yield this.app.vault.read(active_file);
            const { new_content, positions } = this.replace_and_get_cursor_positions(content);
            if (positions) {
                yield this.app.vault.modify(active_file, new_content);
                this.set_cursor_location(positions);
            }
        });
    }
    replace_and_get_cursor_positions(content) {
        let cursor_matches = [];
        let match;
        while ((match = this.cursor_regex.exec(content)) != null) {
            cursor_matches.push(match);
        }
        if (cursor_matches.length === 0) {
            return {};
        }
        cursor_matches.sort((m1, m2) => {
            return Number(m1.groups["order"]) - Number(m2.groups["order"]);
        });
        let match_str = cursor_matches[0][0];
        cursor_matches = cursor_matches.filter(m => {
            return m[0] === match_str;
        });
        let positions = [];
        let index_offset = 0;
        for (let match of cursor_matches) {
            let index = match.index - index_offset;
            positions.push(this.get_editor_position_from_index(content, index));
            content = content.replace(new RegExp(escapeRegExp$1(match[0])), "");
            index_offset += match[0].length;
            // TODO: Remove this, breaking for now waiting for the new setSelections API
            break;
            /*
            // For tp.file.cursor(), we only find one
            if (match[1] === "") {
                break;
            }
            */
        }
        return { new_content: content, positions: positions };
    }
    set_cursor_location(positions) {
        let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (active_view === null) {
            return;
        }
        // TODO: Remove this
        let editor = active_view.editor;
        editor.focus();
        editor.setCursor(positions[0]);
        /*
        let selections = [];
        for (let pos of positions) {
            selections.push({anchor: pos, head: pos});
        }
        editor.focus();
        editor.setSelections(selections);
        */
        /*
        // Check https://github.com/obsidianmd/obsidian-api/issues/14

        let editor = active_view.editor;
        editor.focus();

        for (let pos of positions) {
            let transaction: EditorTransaction = {
                selection: {
                    from: pos
                }
            };
            editor.transaction(transaction);
        }
        */
    }
}

var ContextMode;
(function (ContextMode) {
    ContextMode[ContextMode["USER"] = 0] = "USER";
    ContextMode[ContextMode["INTERNAL"] = 1] = "INTERNAL";
    ContextMode[ContextMode["USER_INTERNAL"] = 2] = "USER_INTERNAL";
    ContextMode[ContextMode["DYNAMIC"] = 3] = "DYNAMIC";
})(ContextMode || (ContextMode = {}));
// TODO: Remove that
const tp_cursor = new RegExp("<%\\s*tp.file.cursor\\s*%>");
class TemplateParser extends TParser {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.userTemplateParser = null;
        this.cursor_jumper = new CursorJumper(this.app);
        this.internalTemplateParser = new InternalTemplateParser(this.app, this.plugin);
        // TODO: Add mobile support
        if (!this.app.isMobile) {
            this.userTemplateParser = new UserTemplateParser(this.app, this.plugin);
        }
    }
    setCurrentContext(file, context_mode) {
        return __awaiter(this, void 0, void 0, function* () {
            this.current_context = yield this.generateContext(file, context_mode);
        });
    }
    generateContext(file, context_mode = ContextMode.USER_INTERNAL) {
        return __awaiter(this, void 0, void 0, function* () {
            let context = {};
            let internal_context = yield this.internalTemplateParser.generateContext(file);
            let user_context = {};
            if (!this.current_context) {
                // If a user system command is using tp.file.include, we need the context to be set.
                this.current_context = internal_context;
            }
            switch (context_mode) {
                case ContextMode.USER:
                    if (this.userTemplateParser) {
                        user_context = yield this.userTemplateParser.generateContext(file);
                    }
                    context = {
                        user: Object.assign({}, user_context)
                    };
                    break;
                case ContextMode.INTERNAL:
                    context = internal_context;
                    break;
                case ContextMode.DYNAMIC:
                    if (this.userTemplateParser) {
                        user_context = yield this.userTemplateParser.generateContext(file);
                    }
                    context = {
                        dynamic: Object.assign(Object.assign({}, internal_context), { user: Object.assign({}, user_context) })
                    };
                    break;
                case ContextMode.USER_INTERNAL:
                    if (this.userTemplateParser) {
                        user_context = yield this.userTemplateParser.generateContext(file);
                    }
                    context = Object.assign(Object.assign({}, internal_context), { user: Object.assign({}, user_context) });
                    break;
            }
            return context;
        });
    }
    parseTemplates(content, context) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!context) {
                context = this.current_context;
            }
            if (content.match(tp_cursor)) {
                this.plugin.log_update(`tp.file.cursor was updated! It's now an internal function, you should call it like so: tp.file.cursor() <br/>
tp.file.cursor now supports cursor jump order! Specify the jump order as an argument (tp.file.cursor(1), tp.file.cursor(2), ...), if you wish to change the default top to bottom order.<br/>
Check the <a href='https://silentvoid13.github.io/Templater/docs/internal-variables-functions/internal-modules/file-module'>documentation</a> for more informations.`);
            }
            try {
                content = (yield renderAsync(content, context, {
                    varName: "tp",
                    parse: {
                        exec: "*",
                        interpolate: "~",
                        raw: "",
                    },
                    autoTrim: false,
                    globalAwait: true,
                }));
            }
            catch (error) {
                this.plugin.log_error("Template parsing error, aborting.", error);
            }
            return content;
        });
    }
    replace_in_active_file() {
        try {
            let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (active_view === null) {
                throw new Error("Active view is null");
            }
            this.replace_templates_and_overwrite_in_file(active_view.file);
        }
        catch (error) {
            this.plugin.log_error(error);
        }
    }
    create_new_note_from_template(template_file, folder) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let template_content = yield this.app.vault.read(template_file);
                if (!folder) {
                    folder = this.app.fileManager.getNewFileParent("");
                    //folder = this.app.vault.getConfig("newFileFolderPath");
                }
                // TODO: Change that, not stable atm
                // @ts-ignore
                let created_note = yield this.app.fileManager.createNewMarkdownFile(folder, "Untitled");
                //let created_note = await this.app.vault.create("Untitled.md", "");
                yield this.setCurrentContext(created_note, ContextMode.USER_INTERNAL);
                let content = yield this.plugin.parser.parseTemplates(template_content);
                yield this.app.vault.modify(created_note, content);
                let active_leaf = this.app.workspace.activeLeaf;
                if (!active_leaf) {
                    throw new Error("No active leaf");
                }
                yield active_leaf.openFile(created_note, { state: { mode: 'source' }, eState: { rename: 'all' } });
                yield this.cursor_jumper.jump_to_next_cursor_location();
            }
            catch (error) {
                this.plugin.log_error(error);
            }
        });
    }
    replace_templates_and_append(template_file) {
        return __awaiter(this, void 0, void 0, function* () {
            let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (active_view === null) {
                throw new Error("No active view, can't append templates.");
            }
            let editor = active_view.editor;
            let doc = editor.getDoc();
            let content = yield this.app.vault.read(template_file);
            yield this.setCurrentContext(active_view.file, ContextMode.USER_INTERNAL);
            content = yield this.parseTemplates(content);
            doc.replaceSelection(content);
            yield this.cursor_jumper.jump_to_next_cursor_location();
            editor.focus();
        });
    }
    replace_templates_and_overwrite_in_file(file) {
        return __awaiter(this, void 0, void 0, function* () {
            let content = yield this.app.vault.read(file);
            yield this.setCurrentContext(file, ContextMode.USER_INTERNAL);
            let new_content = yield this.parseTemplates(content);
            if (new_content !== content) {
                yield this.app.vault.modify(file, new_content);
                if (this.app.workspace.getActiveFile() === file) {
                    yield this.cursor_jumper.jump_to_next_cursor_location();
                }
            }
        });
    }
}

class TemplaterPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.fuzzySuggest = new TemplaterFuzzySuggestModal(this.app, this);
            this.parser = new TemplateParser(this.app, this);
            this.registerMarkdownPostProcessor((el, ctx) => this.dynamic_templates_processor(el, ctx));
            obsidian.addIcon("templater-icon", ICON_DATA);
            this.addRibbonIcon('templater-icon', 'Templater', () => __awaiter(this, void 0, void 0, function* () {
                this.fuzzySuggest.insert_template();
            }));
            this.addCommand({
                id: "insert-templater",
                name: "Insert Template",
                hotkeys: [
                    {
                        modifiers: ["Alt"],
                        key: 'e',
                    },
                ],
                callback: () => {
                    this.fuzzySuggest.insert_template();
                },
            });
            this.addCommand({
                id: "replace-in-file-templater",
                name: "Replace templates in the active file",
                hotkeys: [
                    {
                        modifiers: ["Alt"],
                        key: 'r',
                    },
                ],
                callback: () => {
                    this.parser.replace_in_active_file();
                },
            });
            this.addCommand({
                id: "jump-to-next-cursor-location",
                name: "Jump to next cursor location",
                hotkeys: [
                    {
                        modifiers: ["Alt"],
                        key: "Tab",
                    },
                ],
                callback: () => {
                    try {
                        this.parser.cursor_jumper.jump_to_next_cursor_location();
                    }
                    catch (error) {
                        this.log_error(error);
                    }
                }
            });
            this.addCommand({
                id: "create-new-note-from-template",
                name: "Create new note from template",
                hotkeys: [
                    {
                        modifiers: ["Alt"],
                        key: "n",
                    },
                ],
                callback: () => {
                    this.fuzzySuggest.create_new_note_from_template();
                }
            });
            this.app.workspace.onLayoutReady(() => {
                this.registerEvent(
                // TODO: Find a way to not trigger this on files copy
                this.app.vault.on("create", (file) => __awaiter(this, void 0, void 0, function* () {
                    // TODO: find a better way to do this
                    // Currently, I have to wait for the daily note plugin to add the file content before replacing
                    // Not a problem with Calendar however since it creates the file with the existing content
                    yield delay(300);
                    // ! This could corrupt binary files
                    if (!(file instanceof obsidian.TFile) || file.extension !== "md") {
                        return;
                    }
                    this.parser.replace_templates_and_overwrite_in_file(file);
                })));
            });
            this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
                if (file instanceof obsidian.TFolder) {
                    menu.addItem((item) => {
                        item.setTitle("Create new note from template")
                            .setIcon("templater-icon")
                            .onClick(evt => {
                            this.fuzzySuggest.create_new_note_from_template(file);
                        });
                    });
                }
            }));
            this.addSettingTab(new TemplaterSettingTab(this.app, this));
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    log_update(msg) {
        let notice = new obsidian.Notice("", 15000);
        // TODO: Find better way for this
        // @ts-ignore
        notice.noticeEl.innerHTML = `<b>Templater update</b>: ${msg}`;
    }
    log_error(msg, error) {
        let notice = new obsidian.Notice("", 8000);
        if (error) {
            // TODO: Find a better way for this
            // @ts-ignore
            notice.noticeEl.innerHTML = `<b>Templater Error</b>: ${msg}<br/>Check console for more informations`;
            console.error(msg, error);
        }
        else {
            // @ts-ignore
            notice.noticeEl.innerHTML = `<b>Templater Error</b>: ${msg}`;
        }
    }
    dynamic_templates_processor(el, ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            if (el.textContent.contains("tp.dynamic")) {
                // TODO: This will not always be the active file, 
                // I need to use getFirstLinkpathDest and ctx to find the actual file
                let file = this.app.workspace.getActiveFile();
                yield this.parser.setCurrentContext(file, ContextMode.DYNAMIC);
                let new_html = yield this.parser.parseTemplates(el.innerHTML);
                el.innerHTML = new_html;
            }
        });
    }
}

module.exports = TemplaterPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9TZXR0aW5ncy50cyIsInNyYy9VdGlscy50cyIsInNyYy9UZW1wbGF0ZXJGdXp6eVN1Z2dlc3QudHMiLCJub2RlX21vZHVsZXMvZXRhL2Rpc3QvZXRhLmVzLmpzIiwic3JjL1RQYXJzZXIudHMiLCJzcmMvSW50ZXJuYWxUZW1wbGF0ZXMvSW50ZXJuYWxNb2R1bGUudHMiLCJzcmMvSW50ZXJuYWxUZW1wbGF0ZXMvZGF0ZS9JbnRlcm5hbE1vZHVsZURhdGUudHMiLCJzcmMvQ29uc3RhbnRzLnRzIiwic3JjL0ludGVybmFsVGVtcGxhdGVzL2ZpbGUvSW50ZXJuYWxNb2R1bGVGaWxlLnRzIiwic3JjL0ludGVybmFsVGVtcGxhdGVzL3dlYi9JbnRlcm5hbE1vZHVsZVdlYi50cyIsInNyYy9JbnRlcm5hbFRlbXBsYXRlcy9mcm9udG1hdHRlci9JbnRlcm5hbE1vZHVsZUZyb250bWF0dGVyLnRzIiwic3JjL0ludGVybmFsVGVtcGxhdGVzL3N5c3RlbS9Qcm9tcHRNb2RhbC50cyIsInNyYy9JbnRlcm5hbFRlbXBsYXRlcy9zeXN0ZW0vSW50ZXJuYWxNb2R1bGVTeXN0ZW0udHMiLCJzcmMvSW50ZXJuYWxUZW1wbGF0ZXMvSW50ZXJuYWxUZW1wbGF0ZVBhcnNlci50cyIsInNyYy9Vc2VyVGVtcGxhdGVzL1VzZXJUZW1wbGF0ZVBhcnNlci50cyIsInNyYy9DdXJzb3JKdW1wZXIudHMiLCJzcmMvVGVtcGxhdGVQYXJzZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXHJcblxyXG5QZXJtaXNzaW9uIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBhbmQvb3IgZGlzdHJpYnV0ZSB0aGlzIHNvZnR3YXJlIGZvciBhbnlcclxucHVycG9zZSB3aXRoIG9yIHdpdGhvdXQgZmVlIGlzIGhlcmVieSBncmFudGVkLlxyXG5cclxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiBBTkQgVEhFIEFVVEhPUiBESVNDTEFJTVMgQUxMIFdBUlJBTlRJRVMgV0lUSFxyXG5SRUdBUkQgVE8gVEhJUyBTT0ZUV0FSRSBJTkNMVURJTkcgQUxMIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFlcclxuQU5EIEZJVE5FU1MuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1IgQkUgTElBQkxFIEZPUiBBTlkgU1BFQ0lBTCwgRElSRUNULFxyXG5JTkRJUkVDVCwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIE9SIEFOWSBEQU1BR0VTIFdIQVRTT0VWRVIgUkVTVUxUSU5HIEZST01cclxuTE9TUyBPRiBVU0UsIERBVEEgT1IgUFJPRklUUywgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIE5FR0xJR0VOQ0UgT1JcclxuT1RIRVIgVE9SVElPVVMgQUNUSU9OLCBBUklTSU5HIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFVTRSBPUlxyXG5QRVJGT1JNQU5DRSBPRiBUSElTIFNPRlRXQVJFLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG4vKiBnbG9iYWwgUmVmbGVjdCwgUHJvbWlzZSAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnO1xyXG4gICAgcmV0dXJuIGcgPSB7IG5leHQ6IHZlcmIoMCksIFwidGhyb3dcIjogdmVyYigxKSwgXCJyZXR1cm5cIjogdmVyYigyKSB9LCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKF8pIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChmID0gMSwgeSAmJiAodCA9IG9wWzBdICYgMiA/IHlbXCJyZXR1cm5cIl0gOiBvcFswXSA/IHlbXCJ0aHJvd1wiXSB8fCAoKHQgPSB5W1wicmV0dXJuXCJdKSAmJiB0LmNhbGwoeSksIDApIDogeS5uZXh0KSAmJiAhKHQgPSB0LmNhbGwoeSwgb3BbMV0pKS5kb25lKSByZXR1cm4gdDtcclxuICAgICAgICAgICAgaWYgKHkgPSAwLCB0KSBvcCA9IFtvcFswXSAmIDIsIHQudmFsdWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKG9wWzBdKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDA6IGNhc2UgMTogdCA9IG9wOyBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgNDogXy5sYWJlbCsrOyByZXR1cm4geyB2YWx1ZTogb3BbMV0sIGRvbmU6IGZhbHNlIH07XHJcbiAgICAgICAgICAgICAgICBjYXNlIDU6IF8ubGFiZWwrKzsgeSA9IG9wWzFdOyBvcCA9IFswXTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDc6IG9wID0gXy5vcHMucG9wKCk7IF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHQgPSBfLnRyeXMsIHQgPSB0Lmxlbmd0aCA+IDAgJiYgdFt0Lmxlbmd0aCAtIDFdKSAmJiAob3BbMF0gPT09IDYgfHwgb3BbMF0gPT09IDIpKSB7IF8gPSAwOyBjb250aW51ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gMyAmJiAoIXQgfHwgKG9wWzFdID4gdFswXSAmJiBvcFsxXSA8IHRbM10pKSkgeyBfLmxhYmVsID0gb3BbMV07IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSA2ICYmIF8ubGFiZWwgPCB0WzFdKSB7IF8ubGFiZWwgPSB0WzFdOyB0ID0gb3A7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHQgJiYgXy5sYWJlbCA8IHRbMl0pIHsgXy5sYWJlbCA9IHRbMl07IF8ub3BzLnB1c2gob3ApOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0WzJdKSBfLm9wcy5wb3AoKTtcclxuICAgICAgICAgICAgICAgICAgICBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG9wID0gYm9keS5jYWxsKHRoaXNBcmcsIF8pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgb3AgPSBbNiwgZV07IHkgPSAwOyB9IGZpbmFsbHkgeyBmID0gdCA9IDA7IH1cclxuICAgICAgICBpZiAob3BbMF0gJiA1KSB0aHJvdyBvcFsxXTsgcmV0dXJuIHsgdmFsdWU6IG9wWzBdID8gb3BbMV0gOiB2b2lkIDAsIGRvbmU6IHRydWUgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2NyZWF0ZUJpbmRpbmcgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIGsyLCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH0pO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSkge1xyXG4gICAgZm9yICh2YXIgaSA9IDAsIGlsID0gZnJvbS5sZW5ndGgsIGogPSB0by5sZW5ndGg7IGkgPCBpbDsgaSsrLCBqKyspXHJcbiAgICAgICAgdG9bal0gPSBmcm9tW2ldO1xyXG4gICAgcmV0dXJuIHRvO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpZiAoZ1tuXSkgaVtuXSA9IGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAoYSwgYikgeyBxLnB1c2goW24sIHYsIGEsIGJdKSA+IDEgfHwgcmVzdW1lKG4sIHYpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IG4gPT09IFwicmV0dXJuXCIgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0U3Rhcihtb2QpIHtcclxuICAgIGlmIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpIHJldHVybiBtb2Q7XHJcbiAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICBpZiAobW9kICE9IG51bGwpIGZvciAodmFyIGsgaW4gbW9kKSBpZiAoayAhPT0gXCJkZWZhdWx0XCIgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG1vZCwgaykpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwgayk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCBUZW1wbGF0ZXJQbHVnaW4gZnJvbSAnLi9tYWluJztcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFRlbXBsYXRlclNldHRpbmdzID0ge1xuXHRjb21tYW5kX3RpbWVvdXQ6IDUsXG5cdHRlbXBsYXRlX2ZvbGRlcjogXCJcIixcblx0dGVtcGxhdGVzX3BhaXJzOiBbW1wiXCIsIFwiXCJdXSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVtcGxhdGVyU2V0dGluZ3Mge1xuXHRjb21tYW5kX3RpbWVvdXQ6IG51bWJlcjtcblx0dGVtcGxhdGVfZm9sZGVyOiBzdHJpbmc7XG5cdHRlbXBsYXRlc19wYWlyczogQXJyYXk8W3N0cmluZywgc3RyaW5nXT47XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZXJTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyBhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IFRlbXBsYXRlclBsdWdpbikge1xuXHRcdHN1cGVyKGFwcCwgcGx1Z2luKTtcblx0fVxuXG5cdGRpc3BsYXkoKTogdm9pZCB7XG5cdFx0bGV0IHtjb250YWluZXJFbH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cblx0XHRsZXQgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0bGV0IGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcblx0XHRsaW5rLmhyZWYgPSBcImh0dHBzOi8vc2lsZW50dm9pZDEzLmdpdGh1Yi5pby9UZW1wbGF0ZXIvXCI7XG5cdFx0bGluay50ZXh0ID0gXCJkb2N1bWVudGF0aW9uXCI7XG5cdFx0ZnJhZ21lbnQuYXBwZW5kKFwiQ2hlY2sgdGhlIFwiKTtcblx0XHRmcmFnbWVudC5hcHBlbmQobGluayk7XG5cdFx0ZnJhZ21lbnQuYXBwZW5kKFwiIHRvIGdldCBhIGxpc3Qgb2YgYWxsIHRoZSBhdmFpbGFibGUgaW50ZXJuYWwgdmFyaWFibGVzIC8gZnVuY3Rpb25zLlwiKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJUZW1wbGF0ZSBmb2xkZXIgbG9jYXRpb25cIilcblx0XHRcdC5zZXREZXNjKFwiRmlsZXMgaW4gdGhpcyBmb2xkZXIgd2lsbCBiZSBhdmFpbGFibGUgYXMgdGVtcGxhdGVzLlwiKVxuXHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdHRleHQuc2V0UGxhY2Vob2xkZXIoXCJFeGFtcGxlOiBmb2xkZXIgMS9mb2xkZXIgMlwiKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZV9mb2xkZXIpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKChuZXdfZm9sZGVyKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZV9mb2xkZXIgPSBuZXdfZm9sZGVyO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdH0pO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlRpbWVvdXRcIilcblx0XHRcdC5zZXREZXNjKFwiTWF4aW11bSB0aW1lb3V0IGluIHNlY29uZHMgZm9yIGEgc3lzdGVtIGNvbW1hbmQuXCIpXG5cdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHtcblx0XHRcdFx0dGV4dC5zZXRQbGFjZWhvbGRlcihcIlRpbWVvdXRcIilcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29tbWFuZF90aW1lb3V0LnRvU3RyaW5nKCkpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKChuZXdfdmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdGxldCBuZXdfdGltZW91dCA9IE51bWJlcihuZXdfdmFsdWUpO1xuXHRcdFx0XHRcdFx0aWYgKGlzTmFOKG5ld190aW1lb3V0KSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5sb2dfZXJyb3IoXCJUaW1lb3V0IG11c3QgYmUgYSBudW1iZXJcIik7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbW1hbmRfdGltZW91dCA9IG5ld190aW1lb3V0O1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdH0pO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIkludGVybmFsIFZhcmlhYmxlcyBhbmQgRnVuY3Rpb25zXCIpXG5cdFx0XHQuc2V0RGVzYyhmcmFnbWVudCk7XG5cblx0XHRsZXQgaSA9IDE7XG5cdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudGVtcGxhdGVzX3BhaXJzLmZvckVhY2goKHRlbXBsYXRlX3BhaXIpID0+IHtcblx0XHRcdGxldCBkaXYgPSBjb250YWluZXJFbC5jcmVhdGVFbCgnZGl2Jyk7XG5cdFx0XHRkaXYuYWRkQ2xhc3MoXCJ0ZW1wbGF0ZXJfZGl2XCIpO1xuXG5cdFx0XHRsZXQgdGl0bGUgPSBjb250YWluZXJFbC5jcmVhdGVFbCgnaDQnLCB7XG5cdFx0XHRcdHRleHQ6ICdVc2VyIEZ1bmN0aW9uIG7CsCcgKyBpLFxuXHRcdFx0fSk7XG5cdFx0XHR0aXRsZS5hZGRDbGFzcyhcInRlbXBsYXRlcl90aXRsZVwiKTtcblxuXHRcdFx0bGV0IHNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LmFkZEV4dHJhQnV0dG9uKGV4dHJhID0+IHtcblx0XHRcdFx0XHRleHRyYS5zZXRJY29uKFwiY3Jvc3NcIilcblx0XHRcdFx0XHRcdC5zZXRUb29sdGlwKFwiRGVsZXRlXCIpXG5cdFx0XHRcdFx0XHQub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGxldCBpbmRleCA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnRlbXBsYXRlc19wYWlycy5pbmRleE9mKHRlbXBsYXRlX3BhaXIpO1xuXHRcdFx0XHRcdFx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnRlbXBsYXRlc19wYWlycy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHRcdFx0XHRcdC8vIEZvcmNlIHJlZnJlc2hcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0fSlcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdFx0XHRsZXQgdCA9IHRleHQuc2V0UGxhY2Vob2xkZXIoJ0Z1bmN0aW9uIG5hbWUnKVxuXHRcdFx0XHRcdFx0LnNldFZhbHVlKHRlbXBsYXRlX3BhaXJbMF0pXG5cdFx0XHRcdFx0XHQub25DaGFuZ2UoKG5ld192YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRsZXQgaW5kZXggPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZXNfcGFpcnMuaW5kZXhPZih0ZW1wbGF0ZV9wYWlyKTtcblx0XHRcdFx0XHRcdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZXNfcGFpcnNbaW5kZXhdWzBdID0gbmV3X3ZhbHVlO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHQuaW5wdXRFbC5hZGRDbGFzcyhcInRlbXBsYXRlcl90ZW1wbGF0ZVwiKTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIHQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHQpXG5cdFx0XHRcdC5hZGRUZXh0QXJlYSh0ZXh0ID0+IHtcblx0XHRcdFx0XHRsZXQgdCA9IHRleHQuc2V0UGxhY2Vob2xkZXIoJ1N5c3RlbSBDb21tYW5kJylcblx0XHRcdFx0XHQuc2V0VmFsdWUodGVtcGxhdGVfcGFpclsxXSlcblx0XHRcdFx0XHQub25DaGFuZ2UoKG5ld19jbWQpID0+IHtcblx0XHRcdFx0XHRcdGxldCBpbmRleCA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnRlbXBsYXRlc19wYWlycy5pbmRleE9mKHRlbXBsYXRlX3BhaXIpO1xuXHRcdFx0XHRcdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudGVtcGxhdGVzX3BhaXJzW2luZGV4XVsxXSA9IG5ld19jbWQ7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0dC5pbnB1dEVsLnNldEF0dHIoXCJyb3dzXCIsIDQpO1xuXHRcdFx0XHRcdHQuaW5wdXRFbC5hZGRDbGFzcyhcInRlbXBsYXRlcl9jbWRcIik7XG5cblx0XHRcdFx0XHRyZXR1cm4gdDtcblx0XHRcdFx0fSk7XG5cblx0XHRcdHNldHRpbmcuaW5mb0VsLnJlbW92ZSgpO1xuXG5cdFx0XHRkaXYuYXBwZW5kQ2hpbGQodGl0bGUpO1xuXHRcdFx0ZGl2LmFwcGVuZENoaWxkKGNvbnRhaW5lckVsLmxhc3RDaGlsZCk7XG5cblx0XHRcdGkrPTE7XG5cdFx0fSk7XG5cblx0XHRsZXQgZGl2ID0gY29udGFpbmVyRWwuY3JlYXRlRWwoJ2RpdicpO1xuXHRcdGRpdi5hZGRDbGFzcyhcInRlbXBsYXRlcl9kaXYyXCIpO1xuXG5cdFx0bGV0IHNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5hZGRCdXR0b24oYnV0dG9uID0+IHtcblx0XHRcdFx0bGV0IGIgPSBidXR0b24uc2V0QnV0dG9uVGV4dChcIkFkZCBOZXcgVXNlciBGdW5jdGlvblwiKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZXNfcGFpcnMucHVzaChbXCJcIiwgXCJcIl0pO1xuXHRcdFx0XHRcdC8vIEZvcmNlIHJlZnJlc2hcblx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGIuYnV0dG9uRWwuYWRkQ2xhc3MoXCJ0ZW1wbGF0ZXJfYnV0dG9uXCIpO1xuXG5cdFx0XHRcdHJldHVybiBiO1xuXHRcdFx0fSk7XG5cdFx0c2V0dGluZy5pbmZvRWwucmVtb3ZlKCk7XG5cblx0XHRkaXYuYXBwZW5kQ2hpbGQoY29udGFpbmVyRWwubGFzdENoaWxkKTtcblx0fVxufSIsImltcG9ydCB7IEFwcCwgbm9ybWFsaXplUGF0aCwgVEFic3RyYWN0RmlsZSwgVEZpbGUsIFRGb2xkZXIsIFZhdWx0IH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWxheShtczogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCByZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpICk7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlUmVnRXhwKHN0cjogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpOyAvLyAkJiBtZWFucyB0aGUgd2hvbGUgbWF0Y2hlZCBzdHJpbmdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRGaWxlc0Zyb21Gb2xkZXIoYXBwOiBBcHAsIGZvbGRlcl9zdHI6IHN0cmluZyk6IEFycmF5PFRGaWxlPiB7XG4gICAgZm9sZGVyX3N0ciA9IG5vcm1hbGl6ZVBhdGgoZm9sZGVyX3N0cik7XG5cbiAgICBsZXQgZm9sZGVyID0gYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmb2xkZXJfc3RyKTtcbiAgICBpZiAoIWZvbGRlcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7Zm9sZGVyX3N0cn0gZm9sZGVyIGRvZXNuJ3QgZXhpc3RgKTtcbiAgICB9XG4gICAgaWYgKCEoZm9sZGVyIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZvbGRlcl9zdHJ9IGlzIGEgZmlsZSwgbm90IGEgZm9sZGVyYCk7XG4gICAgfVxuXG4gICAgbGV0IGZpbGVzOiBBcnJheTxURmlsZT4gPSBbXTtcbiAgICBWYXVsdC5yZWN1cnNlQ2hpbGRyZW4oZm9sZGVyLCAoZmlsZTogVEFic3RyYWN0RmlsZSkgPT4ge1xuICAgICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgICBmaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBmaWxlcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIHJldHVybiBhLmJhc2VuYW1lLmxvY2FsZUNvbXBhcmUoYi5iYXNlbmFtZSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZmlsZXM7XG59IiwiaW1wb3J0IHsgQXBwLCBGdXp6eVN1Z2dlc3RNb2RhbCwgVEZpbGUsIFRGb2xkZXIsIG5vcm1hbGl6ZVBhdGgsIFZhdWx0LCBUQWJzdHJhY3RGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBnZXRURmlsZXNGcm9tRm9sZGVyIH0gZnJvbSBcIlV0aWxzXCI7XG5pbXBvcnQgVGVtcGxhdGVyUGx1Z2luIGZyb20gJy4vbWFpbic7XG5cbmV4cG9ydCBlbnVtIE9wZW5Nb2RlIHtcbiAgICBJbnNlcnRUZW1wbGF0ZSxcbiAgICBDcmVhdGVOb3RlVGVtcGxhdGUsXG59O1xuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVyRnV6enlTdWdnZXN0TW9kYWwgZXh0ZW5kcyBGdXp6eVN1Z2dlc3RNb2RhbDxURmlsZT4ge1xuICAgIHB1YmxpYyBhcHA6IEFwcDtcbiAgICBwcml2YXRlIHBsdWdpbjogVGVtcGxhdGVyUGx1Z2luO1xuICAgIHByaXZhdGUgb3Blbl9tb2RlOiBPcGVuTW9kZTtcbiAgICBwcml2YXRlIGNyZWF0aW9uX2ZvbGRlcjogVEZvbGRlcjtcblxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IFRlbXBsYXRlclBsdWdpbikge1xuICAgICAgICBzdXBlcihhcHApO1xuICAgICAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgfVxuXG4gICAgZ2V0SXRlbXMoKTogVEZpbGVbXSB7XG4gICAgICAgIGxldCB0ZW1wbGF0ZV9maWxlczogVEZpbGVbXSA9IFtdO1xuXG4gICAgICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZV9mb2xkZXIgPT09IFwiXCIpIHtcbiAgICAgICAgICAgIHRlbXBsYXRlX2ZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGVtcGxhdGVfZmlsZXMgPSBnZXRURmlsZXNGcm9tRm9sZGVyKHRoaXMuYXBwLCB0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZV9mb2xkZXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0ZW1wbGF0ZV9maWxlcztcbiAgICB9XG5cbiAgICBnZXRJdGVtVGV4dChpdGVtOiBURmlsZSk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBpdGVtLmJhc2VuYW1lO1xuICAgIH1cblxuICAgIG9uQ2hvb3NlSXRlbShpdGVtOiBURmlsZSwgX2V2dDogTW91c2VFdmVudCB8IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgc3dpdGNoKHRoaXMub3Blbl9tb2RlKSB7XG4gICAgICAgICAgICBjYXNlIE9wZW5Nb2RlLkluc2VydFRlbXBsYXRlOlxuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnBhcnNlci5yZXBsYWNlX3RlbXBsYXRlc19hbmRfYXBwZW5kKGl0ZW0pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBPcGVuTW9kZS5DcmVhdGVOb3RlVGVtcGxhdGU6XG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ucGFyc2VyLmNyZWF0ZV9uZXdfbm90ZV9mcm9tX3RlbXBsYXRlKGl0ZW0sIHRoaXMuY3JlYXRpb25fZm9sZGVyKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXJ0KCk6IHZvaWQge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGZpbGVzID0gdGhpcy5nZXRJdGVtcygpO1xuICAgICAgICAgICAgLy8gSWYgdGhlcmUgaXMgb25seSBvbmUgZmlsZSBpbiB0aGUgdGVtcGxhdGVzIGRpcmVjdG9yeSwgd2UgZG9uJ3Qgb3BlbiB0aGUgbW9kYWxcbiAgICAgICAgICAgIGlmIChmaWxlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9uQ2hvb3NlSXRlbShmaWxlc1swXSwgbnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9wZW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubG9nX2Vycm9yKGVycm9yKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGluc2VydF90ZW1wbGF0ZSgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5vcGVuX21vZGUgPSBPcGVuTW9kZS5JbnNlcnRUZW1wbGF0ZTtcbiAgICAgICAgdGhpcy5zdGFydCgpO1xuICAgIH1cblxuICAgIGNyZWF0ZV9uZXdfbm90ZV9mcm9tX3RlbXBsYXRlKGZvbGRlcj86IFRGb2xkZXIpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbl9mb2xkZXIgPSBmb2xkZXI7XG4gICAgICAgIHRoaXMub3Blbl9tb2RlID0gT3Blbk1vZGUuQ3JlYXRlTm90ZVRlbXBsYXRlO1xuICAgICAgICB0aGlzLnN0YXJ0KCk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcbnZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn07XG5cbmZ1bmN0aW9uIHNldFByb3RvdHlwZU9mKG9iaiwgcHJvdG8pIHtcclxuICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxyXG4gICAgaWYgKE9iamVjdC5zZXRQcm90b3R5cGVPZikge1xyXG4gICAgICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZihvYmosIHByb3RvKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIG9iai5fX3Byb3RvX18gPSBwcm90bztcclxuICAgIH1cclxufVxyXG4vLyBUaGlzIGlzIHByZXR0eSBtdWNoIHRoZSBvbmx5IHdheSB0byBnZXQgbmljZSwgZXh0ZW5kZWQgRXJyb3JzXHJcbi8vIHdpdGhvdXQgdXNpbmcgRVM2XHJcbi8qKlxyXG4gKiBUaGlzIHJldHVybnMgYSBuZXcgRXJyb3Igd2l0aCBhIGN1c3RvbSBwcm90b3R5cGUuIE5vdGUgdGhhdCBpdCdzIF9ub3RfIGEgY29uc3RydWN0b3JcclxuICpcclxuICogQHBhcmFtIG1lc3NhZ2UgRXJyb3IgbWVzc2FnZVxyXG4gKlxyXG4gKiAqKkV4YW1wbGUqKlxyXG4gKlxyXG4gKiBgYGBqc1xyXG4gKiB0aHJvdyBFdGFFcnIoXCJ0ZW1wbGF0ZSBub3QgZm91bmRcIilcclxuICogYGBgXHJcbiAqL1xyXG5mdW5jdGlvbiBFdGFFcnIobWVzc2FnZSkge1xyXG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcclxuICAgIHNldFByb3RvdHlwZU9mKGVyciwgRXRhRXJyLnByb3RvdHlwZSk7XHJcbiAgICByZXR1cm4gZXJyO1xyXG59XHJcbkV0YUVyci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSwge1xyXG4gICAgbmFtZTogeyB2YWx1ZTogJ0V0YSBFcnJvcicsIGVudW1lcmFibGU6IGZhbHNlIH1cclxufSk7XHJcbi8qKlxyXG4gKiBUaHJvd3MgYW4gRXRhRXJyIHdpdGggYSBuaWNlbHkgZm9ybWF0dGVkIGVycm9yIGFuZCBtZXNzYWdlIHNob3dpbmcgd2hlcmUgaW4gdGhlIHRlbXBsYXRlIHRoZSBlcnJvciBvY2N1cnJlZC5cclxuICovXHJcbmZ1bmN0aW9uIFBhcnNlRXJyKG1lc3NhZ2UsIHN0ciwgaW5keCkge1xyXG4gICAgdmFyIHdoaXRlc3BhY2UgPSBzdHIuc2xpY2UoMCwgaW5keCkuc3BsaXQoL1xcbi8pO1xyXG4gICAgdmFyIGxpbmVObyA9IHdoaXRlc3BhY2UubGVuZ3RoO1xyXG4gICAgdmFyIGNvbE5vID0gd2hpdGVzcGFjZVtsaW5lTm8gLSAxXS5sZW5ndGggKyAxO1xyXG4gICAgbWVzc2FnZSArPVxyXG4gICAgICAgICcgYXQgbGluZSAnICtcclxuICAgICAgICAgICAgbGluZU5vICtcclxuICAgICAgICAgICAgJyBjb2wgJyArXHJcbiAgICAgICAgICAgIGNvbE5vICtcclxuICAgICAgICAgICAgJzpcXG5cXG4nICtcclxuICAgICAgICAgICAgJyAgJyArXHJcbiAgICAgICAgICAgIHN0ci5zcGxpdCgvXFxuLylbbGluZU5vIC0gMV0gK1xyXG4gICAgICAgICAgICAnXFxuJyArXHJcbiAgICAgICAgICAgICcgICcgK1xyXG4gICAgICAgICAgICBBcnJheShjb2xObykuam9pbignICcpICtcclxuICAgICAgICAgICAgJ14nO1xyXG4gICAgdGhyb3cgRXRhRXJyKG1lc3NhZ2UpO1xyXG59XG5cbi8qKlxyXG4gKiBAcmV0dXJucyBUaGUgZ2xvYmFsIFByb21pc2UgZnVuY3Rpb25cclxuICovXHJcbnZhciBwcm9taXNlSW1wbCA9IG5ldyBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpLlByb21pc2U7XHJcbi8qKlxyXG4gKiBAcmV0dXJucyBBIG5ldyBBc3luY0Z1bmN0aW9uIGNvbnN0dWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIGdldEFzeW5jRnVuY3Rpb25Db25zdHJ1Y3RvcigpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBGdW5jdGlvbigncmV0dXJuIChhc3luYyBmdW5jdGlvbigpe30pLmNvbnN0cnVjdG9yJykoKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xyXG4gICAgICAgICAgICB0aHJvdyBFdGFFcnIoXCJUaGlzIGVudmlyb25tZW50IGRvZXNuJ3Qgc3VwcG9ydCBhc3luYy9hd2FpdFwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRocm93IGU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbi8qKlxyXG4gKiBzdHIudHJpbUxlZnQgcG9seWZpbGxcclxuICpcclxuICogQHBhcmFtIHN0ciAtIElucHV0IHN0cmluZ1xyXG4gKiBAcmV0dXJucyBUaGUgc3RyaW5nIHdpdGggbGVmdCB3aGl0ZXNwYWNlIHJlbW92ZWRcclxuICpcclxuICovXHJcbmZ1bmN0aW9uIHRyaW1MZWZ0KHN0cikge1xyXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWV4dHJhLWJvb2xlYW4tY2FzdFxyXG4gICAgaWYgKCEhU3RyaW5nLnByb3RvdHlwZS50cmltTGVmdCkge1xyXG4gICAgICAgIHJldHVybiBzdHIudHJpbUxlZnQoKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBzdHIucmVwbGFjZSgvXlxccysvLCAnJyk7XHJcbiAgICB9XHJcbn1cclxuLyoqXHJcbiAqIHN0ci50cmltUmlnaHQgcG9seWZpbGxcclxuICpcclxuICogQHBhcmFtIHN0ciAtIElucHV0IHN0cmluZ1xyXG4gKiBAcmV0dXJucyBUaGUgc3RyaW5nIHdpdGggcmlnaHQgd2hpdGVzcGFjZSByZW1vdmVkXHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiB0cmltUmlnaHQoc3RyKSB7XHJcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tZXh0cmEtYm9vbGVhbi1jYXN0XHJcbiAgICBpZiAoISFTdHJpbmcucHJvdG90eXBlLnRyaW1SaWdodCkge1xyXG4gICAgICAgIHJldHVybiBzdHIudHJpbVJpZ2h0KCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICByZXR1cm4gc3RyLnJlcGxhY2UoL1xccyskLywgJycpOyAvLyBUT0RPOiBkbyB3ZSByZWFsbHkgbmVlZCB0byByZXBsYWNlIEJPTSdzP1xyXG4gICAgfVxyXG59XG5cbi8vIFRPRE86IGFsbG93ICctJyB0byB0cmltIHVwIHVudGlsIG5ld2xpbmUuIFVzZSBbXlxcU1xcblxccl0gaW5zdGVhZCBvZiBcXHNcclxuLyogRU5EIFRZUEVTICovXHJcbmZ1bmN0aW9uIGhhc093blByb3Aob2JqLCBwcm9wKSB7XHJcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XHJcbn1cclxuZnVuY3Rpb24gY29weVByb3BzKHRvT2JqLCBmcm9tT2JqKSB7XHJcbiAgICBmb3IgKHZhciBrZXkgaW4gZnJvbU9iaikge1xyXG4gICAgICAgIGlmIChoYXNPd25Qcm9wKGZyb21PYmosIGtleSkpIHtcclxuICAgICAgICAgICAgdG9PYmpba2V5XSA9IGZyb21PYmpba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG9PYmo7XHJcbn1cclxuLyoqXHJcbiAqIFRha2VzIGEgc3RyaW5nIHdpdGhpbiBhIHRlbXBsYXRlIGFuZCB0cmltcyBpdCwgYmFzZWQgb24gdGhlIHByZWNlZGluZyB0YWcncyB3aGl0ZXNwYWNlIGNvbnRyb2wgYW5kIGBjb25maWcuYXV0b1RyaW1gXHJcbiAqL1xyXG5mdW5jdGlvbiB0cmltV1Moc3RyLCBjb25maWcsIHdzTGVmdCwgd3NSaWdodCkge1xyXG4gICAgdmFyIGxlZnRUcmltO1xyXG4gICAgdmFyIHJpZ2h0VHJpbTtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KGNvbmZpZy5hdXRvVHJpbSkpIHtcclxuICAgICAgICAvLyBraW5kYSBjb25mdXNpbmdcclxuICAgICAgICAvLyBidXQgX319IHdpbGwgdHJpbSB0aGUgbGVmdCBzaWRlIG9mIHRoZSBmb2xsb3dpbmcgc3RyaW5nXHJcbiAgICAgICAgbGVmdFRyaW0gPSBjb25maWcuYXV0b1RyaW1bMV07XHJcbiAgICAgICAgcmlnaHRUcmltID0gY29uZmlnLmF1dG9UcmltWzBdO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgbGVmdFRyaW0gPSByaWdodFRyaW0gPSBjb25maWcuYXV0b1RyaW07XHJcbiAgICB9XHJcbiAgICBpZiAod3NMZWZ0IHx8IHdzTGVmdCA9PT0gZmFsc2UpIHtcclxuICAgICAgICBsZWZ0VHJpbSA9IHdzTGVmdDtcclxuICAgIH1cclxuICAgIGlmICh3c1JpZ2h0IHx8IHdzUmlnaHQgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgcmlnaHRUcmltID0gd3NSaWdodDtcclxuICAgIH1cclxuICAgIGlmICghcmlnaHRUcmltICYmICFsZWZ0VHJpbSkge1xyXG4gICAgICAgIHJldHVybiBzdHI7XHJcbiAgICB9XHJcbiAgICBpZiAobGVmdFRyaW0gPT09ICdzbHVycCcgJiYgcmlnaHRUcmltID09PSAnc2x1cnAnKSB7XHJcbiAgICAgICAgcmV0dXJuIHN0ci50cmltKCk7XHJcbiAgICB9XHJcbiAgICBpZiAobGVmdFRyaW0gPT09ICdfJyB8fCBsZWZ0VHJpbSA9PT0gJ3NsdXJwJykge1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCd0cmltbWluZyBsZWZ0JyArIGxlZnRUcmltKVxyXG4gICAgICAgIC8vIGZ1bGwgc2x1cnBcclxuICAgICAgICBzdHIgPSB0cmltTGVmdChzdHIpO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAobGVmdFRyaW0gPT09ICctJyB8fCBsZWZ0VHJpbSA9PT0gJ25sJykge1xyXG4gICAgICAgIC8vIG5sIHRyaW1cclxuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvXig/OlxcclxcbnxcXG58XFxyKS8sICcnKTtcclxuICAgIH1cclxuICAgIGlmIChyaWdodFRyaW0gPT09ICdfJyB8fCByaWdodFRyaW0gPT09ICdzbHVycCcpIHtcclxuICAgICAgICAvLyBmdWxsIHNsdXJwXHJcbiAgICAgICAgc3RyID0gdHJpbVJpZ2h0KHN0cik7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChyaWdodFRyaW0gPT09ICctJyB8fCByaWdodFRyaW0gPT09ICdubCcpIHtcclxuICAgICAgICAvLyBubCB0cmltXHJcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoLyg/OlxcclxcbnxcXG58XFxyKSQvLCAnJyk7IC8vIFRPRE86IG1ha2Ugc3VyZSB0aGlzIGdldHMgXFxyXFxuXHJcbiAgICB9XHJcbiAgICByZXR1cm4gc3RyO1xyXG59XHJcbi8qKlxyXG4gKiBBIG1hcCBvZiBzcGVjaWFsIEhUTUwgY2hhcmFjdGVycyB0byB0aGVpciBYTUwtZXNjYXBlZCBlcXVpdmFsZW50c1xyXG4gKi9cclxudmFyIGVzY01hcCA9IHtcclxuICAgICcmJzogJyZhbXA7JyxcclxuICAgICc8JzogJyZsdDsnLFxyXG4gICAgJz4nOiAnJmd0OycsXHJcbiAgICAnXCInOiAnJnF1b3Q7JyxcclxuICAgIFwiJ1wiOiAnJiMzOTsnXHJcbn07XHJcbmZ1bmN0aW9uIHJlcGxhY2VDaGFyKHMpIHtcclxuICAgIHJldHVybiBlc2NNYXBbc107XHJcbn1cclxuLyoqXHJcbiAqIFhNTC1lc2NhcGVzIGFuIGlucHV0IHZhbHVlIGFmdGVyIGNvbnZlcnRpbmcgaXQgdG8gYSBzdHJpbmdcclxuICpcclxuICogQHBhcmFtIHN0ciAtIElucHV0IHZhbHVlICh1c3VhbGx5IGEgc3RyaW5nKVxyXG4gKiBAcmV0dXJucyBYTUwtZXNjYXBlZCBzdHJpbmdcclxuICovXHJcbmZ1bmN0aW9uIFhNTEVzY2FwZShzdHIpIHtcclxuICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxyXG4gICAgLy8gVG8gZGVhbCB3aXRoIFhTUy4gQmFzZWQgb24gRXNjYXBlIGltcGxlbWVudGF0aW9ucyBvZiBNdXN0YWNoZS5KUyBhbmQgTWFya28sIHRoZW4gY3VzdG9taXplZC5cclxuICAgIHZhciBuZXdTdHIgPSBTdHJpbmcoc3RyKTtcclxuICAgIGlmICgvWyY8PlwiJ10vLnRlc3QobmV3U3RyKSkge1xyXG4gICAgICAgIHJldHVybiBuZXdTdHIucmVwbGFjZSgvWyY8PlwiJ10vZywgcmVwbGFjZUNoYXIpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIG5ld1N0cjtcclxuICAgIH1cclxufVxuXG4vKiBFTkQgVFlQRVMgKi9cclxudmFyIHRlbXBsYXRlTGl0UmVnID0gL2AoPzpcXFxcW1xcc1xcU118XFwkeyg/Oltee31dfHsoPzpbXnt9XXx7W159XSp9KSp9KSp9fCg/IVxcJHspW15cXFxcYF0pKmAvZztcclxudmFyIHNpbmdsZVF1b3RlUmVnID0gLycoPzpcXFxcW1xcc1xcd1wiJ1xcXFxgXXxbXlxcblxccidcXFxcXSkqPycvZztcclxudmFyIGRvdWJsZVF1b3RlUmVnID0gL1wiKD86XFxcXFtcXHNcXHdcIidcXFxcYF18W15cXG5cXHJcIlxcXFxdKSo/XCIvZztcclxuLyoqIEVzY2FwZSBzcGVjaWFsIHJlZ3VsYXIgZXhwcmVzc2lvbiBjaGFyYWN0ZXJzIGluc2lkZSBhIHN0cmluZyAqL1xyXG5mdW5jdGlvbiBlc2NhcGVSZWdFeHAoc3RyaW5nKSB7XHJcbiAgICAvLyBGcm9tIE1ETlxyXG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorXFwtP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpOyAvLyAkJiBtZWFucyB0aGUgd2hvbGUgbWF0Y2hlZCBzdHJpbmdcclxufVxyXG5mdW5jdGlvbiBwYXJzZShzdHIsIGNvbmZpZykge1xyXG4gICAgdmFyIGJ1ZmZlciA9IFtdO1xyXG4gICAgdmFyIHRyaW1MZWZ0T2ZOZXh0U3RyID0gZmFsc2U7XHJcbiAgICB2YXIgbGFzdEluZGV4ID0gMDtcclxuICAgIHZhciBwYXJzZU9wdGlvbnMgPSBjb25maWcucGFyc2U7XHJcbiAgICBpZiAoY29uZmlnLnBsdWdpbnMpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbmZpZy5wbHVnaW5zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBwbHVnaW4gPSBjb25maWcucGx1Z2luc1tpXTtcclxuICAgICAgICAgICAgaWYgKHBsdWdpbi5wcm9jZXNzVGVtcGxhdGUpIHtcclxuICAgICAgICAgICAgICAgIHN0ciA9IHBsdWdpbi5wcm9jZXNzVGVtcGxhdGUoc3RyLCBjb25maWcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyogQWRkaW5nIGZvciBFSlMgY29tcGF0aWJpbGl0eSAqL1xyXG4gICAgaWYgKGNvbmZpZy5ybVdoaXRlc3BhY2UpIHtcclxuICAgICAgICAvLyBDb2RlIHRha2VuIGRpcmVjdGx5IGZyb20gRUpTXHJcbiAgICAgICAgLy8gSGF2ZSB0byB1c2UgdHdvIHNlcGFyYXRlIHJlcGxhY2VzIGhlcmUgYXMgYF5gIGFuZCBgJGAgb3BlcmF0b3JzIGRvbid0XHJcbiAgICAgICAgLy8gd29yayB3ZWxsIHdpdGggYFxccmAgYW5kIGVtcHR5IGxpbmVzIGRvbid0IHdvcmsgd2VsbCB3aXRoIHRoZSBgbWAgZmxhZy5cclxuICAgICAgICAvLyBFc3NlbnRpYWxseSwgdGhpcyByZXBsYWNlcyB0aGUgd2hpdGVzcGFjZSBhdCB0aGUgYmVnaW5uaW5nIGFuZCBlbmQgb2ZcclxuICAgICAgICAvLyBlYWNoIGxpbmUgYW5kIHJlbW92ZXMgbXVsdGlwbGUgbmV3bGluZXMuXHJcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1tcXHJcXG5dKy9nLCAnXFxuJykucmVwbGFjZSgvXlxccyt8XFxzKyQvZ20sICcnKTtcclxuICAgIH1cclxuICAgIC8qIEVuZCBybVdoaXRlc3BhY2Ugb3B0aW9uICovXHJcbiAgICB0ZW1wbGF0ZUxpdFJlZy5sYXN0SW5kZXggPSAwO1xyXG4gICAgc2luZ2xlUXVvdGVSZWcubGFzdEluZGV4ID0gMDtcclxuICAgIGRvdWJsZVF1b3RlUmVnLmxhc3RJbmRleCA9IDA7XHJcbiAgICBmdW5jdGlvbiBwdXNoU3RyaW5nKHN0cm5nLCBzaG91bGRUcmltUmlnaHRPZlN0cmluZykge1xyXG4gICAgICAgIGlmIChzdHJuZykge1xyXG4gICAgICAgICAgICAvLyBpZiBzdHJpbmcgaXMgdHJ1dGh5IGl0IG11c3QgYmUgb2YgdHlwZSAnc3RyaW5nJ1xyXG4gICAgICAgICAgICBzdHJuZyA9IHRyaW1XUyhzdHJuZywgY29uZmlnLCB0cmltTGVmdE9mTmV4dFN0ciwgLy8gdGhpcyB3aWxsIG9ubHkgYmUgZmFsc2Ugb24gdGhlIGZpcnN0IHN0ciwgdGhlIG5leHQgb25lcyB3aWxsIGJlIG51bGwgb3IgdW5kZWZpbmVkXHJcbiAgICAgICAgICAgIHNob3VsZFRyaW1SaWdodE9mU3RyaW5nKTtcclxuICAgICAgICAgICAgaWYgKHN0cm5nKSB7XHJcbiAgICAgICAgICAgICAgICAvLyByZXBsYWNlIFxcIHdpdGggXFxcXCwgJyB3aXRoIFxcJ1xyXG4gICAgICAgICAgICAgICAgLy8gd2UncmUgZ29pbmcgdG8gY29udmVydCBhbGwgQ1JMRiB0byBMRiBzbyBpdCBkb2Vzbid0IHRha2UgbW9yZSB0aGFuIG9uZSByZXBsYWNlXHJcbiAgICAgICAgICAgICAgICBzdHJuZyA9IHN0cm5nLnJlcGxhY2UoL1xcXFx8Jy9nLCAnXFxcXCQmJykucmVwbGFjZSgvXFxyXFxufFxcbnxcXHIvZywgJ1xcXFxuJyk7XHJcbiAgICAgICAgICAgICAgICBidWZmZXIucHVzaChzdHJuZyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICB2YXIgcHJlZml4ZXMgPSBbcGFyc2VPcHRpb25zLmV4ZWMsIHBhcnNlT3B0aW9ucy5pbnRlcnBvbGF0ZSwgcGFyc2VPcHRpb25zLnJhd10ucmVkdWNlKGZ1bmN0aW9uIChhY2N1bXVsYXRvciwgcHJlZml4KSB7XHJcbiAgICAgICAgaWYgKGFjY3VtdWxhdG9yICYmIHByZWZpeCkge1xyXG4gICAgICAgICAgICByZXR1cm4gYWNjdW11bGF0b3IgKyAnfCcgKyBlc2NhcGVSZWdFeHAocHJlZml4KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAocHJlZml4KSB7XHJcbiAgICAgICAgICAgIC8vIGFjY3VtdWxhdG9yIGlzIGZhbHN5XHJcbiAgICAgICAgICAgIHJldHVybiBlc2NhcGVSZWdFeHAocHJlZml4KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIHByZWZpeCBhbmQgYWNjdW11bGF0b3IgYXJlIGJvdGggZmFsc3lcclxuICAgICAgICAgICAgcmV0dXJuIGFjY3VtdWxhdG9yO1xyXG4gICAgICAgIH1cclxuICAgIH0sICcnKTtcclxuICAgIHZhciBwYXJzZU9wZW5SZWcgPSBuZXcgUmVnRXhwKCcoW15dKj8pJyArIGVzY2FwZVJlZ0V4cChjb25maWcudGFnc1swXSkgKyAnKC18Xyk/XFxcXHMqKCcgKyBwcmVmaXhlcyArICcpP1xcXFxzKicsICdnJyk7XHJcbiAgICB2YXIgcGFyc2VDbG9zZVJlZyA9IG5ldyBSZWdFeHAoJ1xcJ3xcInxgfFxcXFwvXFxcXCp8KFxcXFxzKigtfF8pPycgKyBlc2NhcGVSZWdFeHAoY29uZmlnLnRhZ3NbMV0pICsgJyknLCAnZycpO1xyXG4gICAgLy8gVE9ETzogYmVuY2htYXJrIGhhdmluZyB0aGUgXFxzKiBvbiBlaXRoZXIgc2lkZSB2cyB1c2luZyBzdHIudHJpbSgpXHJcbiAgICB2YXIgbTtcclxuICAgIHdoaWxlICgobSA9IHBhcnNlT3BlblJlZy5leGVjKHN0cikpKSB7XHJcbiAgICAgICAgbGFzdEluZGV4ID0gbVswXS5sZW5ndGggKyBtLmluZGV4O1xyXG4gICAgICAgIHZhciBwcmVjZWRpbmdTdHJpbmcgPSBtWzFdO1xyXG4gICAgICAgIHZhciB3c0xlZnQgPSBtWzJdO1xyXG4gICAgICAgIHZhciBwcmVmaXggPSBtWzNdIHx8ICcnOyAvLyBieSBkZWZhdWx0IGVpdGhlciB+LCA9LCBvciBlbXB0eVxyXG4gICAgICAgIHB1c2hTdHJpbmcocHJlY2VkaW5nU3RyaW5nLCB3c0xlZnQpO1xyXG4gICAgICAgIHBhcnNlQ2xvc2VSZWcubGFzdEluZGV4ID0gbGFzdEluZGV4O1xyXG4gICAgICAgIHZhciBjbG9zZVRhZyA9IHZvaWQgMDtcclxuICAgICAgICB2YXIgY3VycmVudE9iaiA9IGZhbHNlO1xyXG4gICAgICAgIHdoaWxlICgoY2xvc2VUYWcgPSBwYXJzZUNsb3NlUmVnLmV4ZWMoc3RyKSkpIHtcclxuICAgICAgICAgICAgaWYgKGNsb3NlVGFnWzFdKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgY29udGVudCA9IHN0ci5zbGljZShsYXN0SW5kZXgsIGNsb3NlVGFnLmluZGV4KTtcclxuICAgICAgICAgICAgICAgIHBhcnNlT3BlblJlZy5sYXN0SW5kZXggPSBsYXN0SW5kZXggPSBwYXJzZUNsb3NlUmVnLmxhc3RJbmRleDtcclxuICAgICAgICAgICAgICAgIHRyaW1MZWZ0T2ZOZXh0U3RyID0gY2xvc2VUYWdbMl07XHJcbiAgICAgICAgICAgICAgICB2YXIgY3VycmVudFR5cGUgPSBwcmVmaXggPT09IHBhcnNlT3B0aW9ucy5leGVjXHJcbiAgICAgICAgICAgICAgICAgICAgPyAnZSdcclxuICAgICAgICAgICAgICAgICAgICA6IHByZWZpeCA9PT0gcGFyc2VPcHRpb25zLnJhd1xyXG4gICAgICAgICAgICAgICAgICAgICAgICA/ICdyJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHByZWZpeCA9PT0gcGFyc2VPcHRpb25zLmludGVycG9sYXRlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/ICdpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAnJztcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRPYmogPSB7IHQ6IGN1cnJlbnRUeXBlLCB2YWw6IGNvbnRlbnQgfTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdmFyIGNoYXIgPSBjbG9zZVRhZ1swXTtcclxuICAgICAgICAgICAgICAgIGlmIChjaGFyID09PSAnLyonKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbW1lbnRDbG9zZUluZCA9IHN0ci5pbmRleE9mKCcqLycsIHBhcnNlQ2xvc2VSZWcubGFzdEluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoY29tbWVudENsb3NlSW5kID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBQYXJzZUVycigndW5jbG9zZWQgY29tbWVudCcsIHN0ciwgY2xvc2VUYWcuaW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBwYXJzZUNsb3NlUmVnLmxhc3RJbmRleCA9IGNvbW1lbnRDbG9zZUluZDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNoYXIgPT09IFwiJ1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2luZ2xlUXVvdGVSZWcubGFzdEluZGV4ID0gY2xvc2VUYWcuaW5kZXg7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNpbmdsZVF1b3RlTWF0Y2ggPSBzaW5nbGVRdW90ZVJlZy5leGVjKHN0cik7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpbmdsZVF1b3RlTWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VDbG9zZVJlZy5sYXN0SW5kZXggPSBzaW5nbGVRdW90ZVJlZy5sYXN0SW5kZXg7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBQYXJzZUVycigndW5jbG9zZWQgc3RyaW5nJywgc3RyLCBjbG9zZVRhZy5pbmRleCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY2hhciA9PT0gJ1wiJykge1xyXG4gICAgICAgICAgICAgICAgICAgIGRvdWJsZVF1b3RlUmVnLmxhc3RJbmRleCA9IGNsb3NlVGFnLmluZGV4O1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkb3VibGVRdW90ZU1hdGNoID0gZG91YmxlUXVvdGVSZWcuZXhlYyhzdHIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkb3VibGVRdW90ZU1hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlQ2xvc2VSZWcubGFzdEluZGV4ID0gZG91YmxlUXVvdGVSZWcubGFzdEluZGV4O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgUGFyc2VFcnIoJ3VuY2xvc2VkIHN0cmluZycsIHN0ciwgY2xvc2VUYWcuaW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNoYXIgPT09ICdgJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlTGl0UmVnLmxhc3RJbmRleCA9IGNsb3NlVGFnLmluZGV4O1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0ZW1wbGF0ZUxpdE1hdGNoID0gdGVtcGxhdGVMaXRSZWcuZXhlYyhzdHIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZW1wbGF0ZUxpdE1hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlQ2xvc2VSZWcubGFzdEluZGV4ID0gdGVtcGxhdGVMaXRSZWcubGFzdEluZGV4O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgUGFyc2VFcnIoJ3VuY2xvc2VkIHN0cmluZycsIHN0ciwgY2xvc2VUYWcuaW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoY3VycmVudE9iaikge1xyXG4gICAgICAgICAgICBidWZmZXIucHVzaChjdXJyZW50T2JqKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIFBhcnNlRXJyKCd1bmNsb3NlZCB0YWcnLCBzdHIsIG0uaW5kZXggKyBwcmVjZWRpbmdTdHJpbmcubGVuZ3RoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBwdXNoU3RyaW5nKHN0ci5zbGljZShsYXN0SW5kZXgsIHN0ci5sZW5ndGgpLCBmYWxzZSk7XHJcbiAgICBpZiAoY29uZmlnLnBsdWdpbnMpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbmZpZy5wbHVnaW5zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBwbHVnaW4gPSBjb25maWcucGx1Z2luc1tpXTtcclxuICAgICAgICAgICAgaWYgKHBsdWdpbi5wcm9jZXNzQVNUKSB7XHJcbiAgICAgICAgICAgICAgICBidWZmZXIgPSBwbHVnaW4ucHJvY2Vzc0FTVChidWZmZXIsIGNvbmZpZyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYnVmZmVyO1xyXG59XG5cbi8qIEVORCBUWVBFUyAqL1xyXG4vKipcclxuICogQ29tcGlsZXMgYSB0ZW1wbGF0ZSBzdHJpbmcgdG8gYSBmdW5jdGlvbiBzdHJpbmcuIE1vc3Qgb2Z0ZW4gdXNlcnMganVzdCB1c2UgYGNvbXBpbGUoKWAsIHdoaWNoIGNhbGxzIGBjb21waWxlVG9TdHJpbmdgIGFuZCBjcmVhdGVzIGEgbmV3IGZ1bmN0aW9uIHVzaW5nIHRoZSByZXN1bHRcclxuICpcclxuICogKipFeGFtcGxlKipcclxuICpcclxuICogYGBganNcclxuICogY29tcGlsZVRvU3RyaW5nKFwiSGkgPCU9IGl0LnVzZXIgJT5cIiwgZXRhLmNvbmZpZylcclxuICogLy8gXCJ2YXIgdFI9JycsaW5jbHVkZT1FLmluY2x1ZGUuYmluZChFKSxpbmNsdWRlRmlsZT1FLmluY2x1ZGVGaWxlLmJpbmQoRSk7dFIrPSdIaSAnO3RSKz1FLmUoaXQudXNlcik7aWYoY2Ipe2NiKG51bGwsdFIpfSByZXR1cm4gdFJcIlxyXG4gKiBgYGBcclxuICovXHJcbmZ1bmN0aW9uIGNvbXBpbGVUb1N0cmluZyhzdHIsIGNvbmZpZykge1xyXG4gICAgdmFyIGJ1ZmZlciA9IHBhcnNlKHN0ciwgY29uZmlnKTtcclxuICAgIHZhciByZXMgPSBcInZhciB0Uj0nJyxfX2wsX19sUFwiICtcclxuICAgICAgICAoY29uZmlnLmluY2x1ZGUgPyAnLGluY2x1ZGU9RS5pbmNsdWRlLmJpbmQoRSknIDogJycpICtcclxuICAgICAgICAoY29uZmlnLmluY2x1ZGVGaWxlID8gJyxpbmNsdWRlRmlsZT1FLmluY2x1ZGVGaWxlLmJpbmQoRSknIDogJycpICtcclxuICAgICAgICAnXFxuZnVuY3Rpb24gbGF5b3V0KHAsZCl7X19sPXA7X19sUD1kfVxcbicgK1xyXG4gICAgICAgIChjb25maWcuZ2xvYmFsQXdhaXQgPyAnbGV0IF9wcnMgPSBbXTtcXG4nIDogJycpICtcclxuICAgICAgICAoY29uZmlnLnVzZVdpdGggPyAnd2l0aCgnICsgY29uZmlnLnZhck5hbWUgKyAnfHx7fSl7JyA6ICcnKSArXHJcbiAgICAgICAgY29tcGlsZVNjb3BlKGJ1ZmZlciwgY29uZmlnKSArXHJcbiAgICAgICAgKGNvbmZpZy5pbmNsdWRlRmlsZVxyXG4gICAgICAgICAgICA/ICdpZihfX2wpdFI9JyArXHJcbiAgICAgICAgICAgICAgICAoY29uZmlnLmFzeW5jID8gJ2F3YWl0ICcgOiAnJykgK1xyXG4gICAgICAgICAgICAgICAgKFwiaW5jbHVkZUZpbGUoX19sLE9iamVjdC5hc3NpZ24oXCIgKyBjb25maWcudmFyTmFtZSArIFwiLHtib2R5OnRSfSxfX2xQKSlcXG5cIilcclxuICAgICAgICAgICAgOiBjb25maWcuaW5jbHVkZVxyXG4gICAgICAgICAgICAgICAgPyAnaWYoX19sKXRSPScgK1xyXG4gICAgICAgICAgICAgICAgICAgIChjb25maWcuYXN5bmMgPyAnYXdhaXQgJyA6ICcnKSArXHJcbiAgICAgICAgICAgICAgICAgICAgKFwiaW5jbHVkZShfX2wsT2JqZWN0LmFzc2lnbihcIiArIGNvbmZpZy52YXJOYW1lICsgXCIse2JvZHk6dFJ9LF9fbFApKVxcblwiKVxyXG4gICAgICAgICAgICAgICAgOiAnJykgK1xyXG4gICAgICAgICdpZihjYil7Y2IobnVsbCx0Uil9IHJldHVybiB0UicgK1xyXG4gICAgICAgIChjb25maWcudXNlV2l0aCA/ICd9JyA6ICcnKTtcclxuICAgIGlmIChjb25maWcucGx1Z2lucykge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29uZmlnLnBsdWdpbnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIHBsdWdpbiA9IGNvbmZpZy5wbHVnaW5zW2ldO1xyXG4gICAgICAgICAgICBpZiAocGx1Z2luLnByb2Nlc3NGblN0cmluZykge1xyXG4gICAgICAgICAgICAgICAgcmVzID0gcGx1Z2luLnByb2Nlc3NGblN0cmluZyhyZXMsIGNvbmZpZyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzO1xyXG59XHJcbi8qKlxyXG4gKiBMb29wcyB0aHJvdWdoIHRoZSBBU1QgZ2VuZXJhdGVkIGJ5IGBwYXJzZWAgYW5kIHRyYW5zZm9ybSBlYWNoIGl0ZW0gaW50byBKUyBjYWxsc1xyXG4gKlxyXG4gKiAqKkV4YW1wbGUqKlxyXG4gKlxyXG4gKiBgYGBqc1xyXG4gKiAvLyBBU1QgdmVyc2lvbiBvZiAnSGkgPCU9IGl0LnVzZXIgJT4nXHJcbiAqIGxldCB0ZW1wbGF0ZUFTVCA9IFsnSGkgJywgeyB2YWw6ICdpdC51c2VyJywgdDogJ2knIH1dXHJcbiAqIGNvbXBpbGVTY29wZSh0ZW1wbGF0ZUFTVCwgZXRhLmNvbmZpZylcclxuICogLy8gXCJ0Uis9J0hpICc7dFIrPUUuZShpdC51c2VyKTtcIlxyXG4gKiBgYGBcclxuICovXHJcbmZ1bmN0aW9uIGNvbXBpbGVTY29wZShidWZmLCBjb25maWcpIHtcclxuICAgIHZhciBpO1xyXG4gICAgdmFyIGJ1ZmZMZW5ndGggPSBidWZmLmxlbmd0aDtcclxuICAgIHZhciByZXR1cm5TdHIgPSAnJztcclxuICAgIGlmIChjb25maWcuZ2xvYmFsQXdhaXQpIHtcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYnVmZkxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBjdXJyZW50QmxvY2sgPSBidWZmW2ldO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJlbnRCbG9jayAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgIHZhciB0eXBlID0gY3VycmVudEJsb2NrLnQ7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZSA9PT0gJ3InIHx8IHR5cGUgPT09ICdpJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjb250ZW50ID0gY3VycmVudEJsb2NrLnZhbCB8fCAnJztcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm5TdHIgKz0gXCJfcHJzLnB1c2goXCIgKyBjb250ZW50ICsgXCIpO1xcblwiO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVyblN0ciArPSAnbGV0IF9yc3QgPSBhd2FpdCBQcm9taXNlLmFsbChfcHJzKTtcXG4nO1xyXG4gICAgfVxyXG4gICAgdmFyIGogPSAwO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IGJ1ZmZMZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBjdXJyZW50QmxvY2sgPSBidWZmW2ldO1xyXG4gICAgICAgIGlmICh0eXBlb2YgY3VycmVudEJsb2NrID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICB2YXIgc3RyID0gY3VycmVudEJsb2NrO1xyXG4gICAgICAgICAgICAvLyB3ZSBrbm93IHN0cmluZyBleGlzdHNcclxuICAgICAgICAgICAgcmV0dXJuU3RyICs9IFwidFIrPSdcIiArIHN0ciArIFwiJ1xcblwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIHR5cGUgPSBjdXJyZW50QmxvY2sudDsgLy8gfiwgcywgISwgPywgclxyXG4gICAgICAgICAgICB2YXIgY29udGVudCA9IGN1cnJlbnRCbG9jay52YWwgfHwgJyc7XHJcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAncicpIHtcclxuICAgICAgICAgICAgICAgIC8vIHJhd1xyXG4gICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5nbG9iYWxBd2FpdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBcIl9yc3RbXCIgKyBqICsgXCJdXCI7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoY29uZmlnLmZpbHRlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQgPSAnRS5maWx0ZXIoJyArIGNvbnRlbnQgKyAnKSc7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm5TdHIgKz0gJ3RSKz0nICsgY29udGVudCArICdcXG4nO1xyXG4gICAgICAgICAgICAgICAgaisrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGUgPT09ICdpJykge1xyXG4gICAgICAgICAgICAgICAgLy8gaW50ZXJwb2xhdGVcclxuICAgICAgICAgICAgICAgIGlmIChjb25maWcuZ2xvYmFsQXdhaXQpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50ID0gXCJfcnN0W1wiICsgaiArIFwiXVwiO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5maWx0ZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50ID0gJ0UuZmlsdGVyKCcgKyBjb250ZW50ICsgJyknO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5hdXRvRXNjYXBlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudCA9ICdFLmUoJyArIGNvbnRlbnQgKyAnKSc7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm5TdHIgKz0gJ3RSKz0nICsgY29udGVudCArICdcXG4nO1xyXG4gICAgICAgICAgICAgICAgaisrO1xyXG4gICAgICAgICAgICAgICAgLy8gcmVmZXJlbmNlXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAodHlwZSA9PT0gJ2UnKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBleGVjdXRlXHJcbiAgICAgICAgICAgICAgICByZXR1cm5TdHIgKz0gY29udGVudCArICdcXG4nOyAvLyB5b3UgbmVlZCBhIFxcbiBpbiBjYXNlIHlvdSBoYXZlIDwlIH0gJT5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiByZXR1cm5TdHI7XHJcbn1cblxuLyoqXHJcbiAqIEhhbmRsZXMgc3RvcmFnZSBhbmQgYWNjZXNzaW5nIG9mIHZhbHVlc1xyXG4gKlxyXG4gKiBJbiB0aGlzIGNhc2UsIHdlIHVzZSBpdCB0byBzdG9yZSBjb21waWxlZCB0ZW1wbGF0ZSBmdW5jdGlvbnNcclxuICogSW5kZXhlZCBieSB0aGVpciBgbmFtZWAgb3IgYGZpbGVuYW1lYFxyXG4gKi9cclxudmFyIENhY2hlciA9IC8qKiBAY2xhc3MgKi8gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIENhY2hlcihjYWNoZSkge1xyXG4gICAgICAgIHRoaXMuY2FjaGUgPSBjYWNoZTtcclxuICAgIH1cclxuICAgIENhY2hlci5wcm90b3R5cGUuZGVmaW5lID0gZnVuY3Rpb24gKGtleSwgdmFsKSB7XHJcbiAgICAgICAgdGhpcy5jYWNoZVtrZXldID0gdmFsO1xyXG4gICAgfTtcclxuICAgIENhY2hlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSkge1xyXG4gICAgICAgIC8vIHN0cmluZyB8IGFycmF5LlxyXG4gICAgICAgIC8vIFRPRE86IGFsbG93IGFycmF5IG9mIGtleXMgdG8gbG9vayBkb3duXHJcbiAgICAgICAgLy8gVE9ETzogY3JlYXRlIHBsdWdpbiB0byBhbGxvdyByZWZlcmVuY2luZyBoZWxwZXJzLCBmaWx0ZXJzIHdpdGggZG90IG5vdGF0aW9uXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FjaGVba2V5XTtcclxuICAgIH07XHJcbiAgICBDYWNoZXIucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIChrZXkpIHtcclxuICAgICAgICBkZWxldGUgdGhpcy5jYWNoZVtrZXldO1xyXG4gICAgfTtcclxuICAgIENhY2hlci5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5jYWNoZSA9IHt9O1xyXG4gICAgfTtcclxuICAgIENhY2hlci5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uIChjYWNoZU9iaikge1xyXG4gICAgICAgIGNvcHlQcm9wcyh0aGlzLmNhY2hlLCBjYWNoZU9iaik7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIENhY2hlcjtcclxufSgpKTtcblxuLyogRU5EIFRZUEVTICovXHJcbi8qKlxyXG4gKiBFdGEncyB0ZW1wbGF0ZSBzdG9yYWdlXHJcbiAqXHJcbiAqIFN0b3JlcyBwYXJ0aWFscyBhbmQgY2FjaGVkIHRlbXBsYXRlc1xyXG4gKi9cclxudmFyIHRlbXBsYXRlcyA9IG5ldyBDYWNoZXIoe30pO1xuXG4vKiBFTkQgVFlQRVMgKi9cclxuLyoqXHJcbiAqIEluY2x1ZGUgYSB0ZW1wbGF0ZSBiYXNlZCBvbiBpdHMgbmFtZSAob3IgZmlsZXBhdGgsIGlmIGl0J3MgYWxyZWFkeSBiZWVuIGNhY2hlZCkuXHJcbiAqXHJcbiAqIENhbGxlZCBsaWtlIGBpbmNsdWRlKHRlbXBsYXRlTmFtZU9yUGF0aCwgZGF0YSlgXHJcbiAqL1xyXG5mdW5jdGlvbiBpbmNsdWRlSGVscGVyKHRlbXBsYXRlTmFtZU9yUGF0aCwgZGF0YSkge1xyXG4gICAgdmFyIHRlbXBsYXRlID0gdGhpcy50ZW1wbGF0ZXMuZ2V0KHRlbXBsYXRlTmFtZU9yUGF0aCk7XHJcbiAgICBpZiAoIXRlbXBsYXRlKSB7XHJcbiAgICAgICAgdGhyb3cgRXRhRXJyKCdDb3VsZCBub3QgZmV0Y2ggdGVtcGxhdGUgXCInICsgdGVtcGxhdGVOYW1lT3JQYXRoICsgJ1wiJyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGVtcGxhdGUoZGF0YSwgdGhpcyk7XHJcbn1cclxuLyoqIEV0YSdzIGJhc2UgKGdsb2JhbCkgY29uZmlndXJhdGlvbiAqL1xyXG52YXIgY29uZmlnID0ge1xyXG4gICAgYXN5bmM6IGZhbHNlLFxyXG4gICAgYXV0b0VzY2FwZTogdHJ1ZSxcclxuICAgIGF1dG9UcmltOiBbZmFsc2UsICdubCddLFxyXG4gICAgY2FjaGU6IGZhbHNlLFxyXG4gICAgZTogWE1MRXNjYXBlLFxyXG4gICAgaW5jbHVkZTogaW5jbHVkZUhlbHBlcixcclxuICAgIHBhcnNlOiB7XHJcbiAgICAgICAgZXhlYzogJycsXHJcbiAgICAgICAgaW50ZXJwb2xhdGU6ICc9JyxcclxuICAgICAgICByYXc6ICd+J1xyXG4gICAgfSxcclxuICAgIHBsdWdpbnM6IFtdLFxyXG4gICAgcm1XaGl0ZXNwYWNlOiBmYWxzZSxcclxuICAgIHRhZ3M6IFsnPCUnLCAnJT4nXSxcclxuICAgIHRlbXBsYXRlczogdGVtcGxhdGVzLFxyXG4gICAgdXNlV2l0aDogZmFsc2UsXHJcbiAgICB2YXJOYW1lOiAnaXQnXHJcbn07XHJcbi8qKlxyXG4gKiBUYWtlcyBvbmUgb3IgdHdvIHBhcnRpYWwgKG5vdCBuZWNlc3NhcmlseSBjb21wbGV0ZSkgY29uZmlndXJhdGlvbiBvYmplY3RzLCBtZXJnZXMgdGhlbSAxIGxheWVyIGRlZXAgaW50byBldGEuY29uZmlnLCBhbmQgcmV0dXJucyB0aGUgcmVzdWx0XHJcbiAqXHJcbiAqIEBwYXJhbSBvdmVycmlkZSBQYXJ0aWFsIGNvbmZpZ3VyYXRpb24gb2JqZWN0XHJcbiAqIEBwYXJhbSBiYXNlQ29uZmlnIFBhcnRpYWwgY29uZmlndXJhdGlvbiBvYmplY3QgdG8gbWVyZ2UgYmVmb3JlIGBvdmVycmlkZWBcclxuICpcclxuICogKipFeGFtcGxlKipcclxuICpcclxuICogYGBganNcclxuICogbGV0IGN1c3RvbUNvbmZpZyA9IGdldENvbmZpZyh7dGFnczogWychIycsICcjISddfSlcclxuICogYGBgXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRDb25maWcob3ZlcnJpZGUsIGJhc2VDb25maWcpIHtcclxuICAgIC8vIFRPRE86IHJ1biBtb3JlIHRlc3RzIG9uIHRoaXNcclxuICAgIHZhciByZXMgPSB7fTsgLy8gTGlua2VkXHJcbiAgICBjb3B5UHJvcHMocmVzLCBjb25maWcpOyAvLyBDcmVhdGVzIGRlZXAgY2xvbmUgb2YgZXRhLmNvbmZpZywgMSBsYXllciBkZWVwXHJcbiAgICBpZiAoYmFzZUNvbmZpZykge1xyXG4gICAgICAgIGNvcHlQcm9wcyhyZXMsIGJhc2VDb25maWcpO1xyXG4gICAgfVxyXG4gICAgaWYgKG92ZXJyaWRlKSB7XHJcbiAgICAgICAgY29weVByb3BzKHJlcywgb3ZlcnJpZGUpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlcztcclxufVxyXG4vKiogVXBkYXRlIEV0YSdzIGJhc2UgY29uZmlnICovXHJcbmZ1bmN0aW9uIGNvbmZpZ3VyZShvcHRpb25zKSB7XHJcbiAgICByZXR1cm4gY29weVByb3BzKGNvbmZpZywgb3B0aW9ucyk7XHJcbn1cblxuLyogRU5EIFRZUEVTICovXHJcbi8qKlxyXG4gKiBUYWtlcyBhIHRlbXBsYXRlIHN0cmluZyBhbmQgcmV0dXJucyBhIHRlbXBsYXRlIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGNhbGxlZCB3aXRoIChkYXRhLCBjb25maWcsIFtjYl0pXHJcbiAqXHJcbiAqIEBwYXJhbSBzdHIgLSBUaGUgdGVtcGxhdGUgc3RyaW5nXHJcbiAqIEBwYXJhbSBjb25maWcgLSBBIGN1c3RvbSBjb25maWd1cmF0aW9uIG9iamVjdCAob3B0aW9uYWwpXHJcbiAqXHJcbiAqICoqRXhhbXBsZSoqXHJcbiAqXHJcbiAqIGBgYGpzXHJcbiAqIGxldCBjb21waWxlZEZuID0gZXRhLmNvbXBpbGUoXCJIaSA8JT0gaXQudXNlciAlPlwiKVxyXG4gKiAvLyBmdW5jdGlvbiBhbm9ueW1vdXMoKVxyXG4gKiBsZXQgY29tcGlsZWRGblN0ciA9IGNvbXBpbGVkRm4udG9TdHJpbmcoKVxyXG4gKiAvLyBcImZ1bmN0aW9uIGFub255bW91cyhpdCxFLGNiXFxuKSB7XFxudmFyIHRSPScnLGluY2x1ZGU9RS5pbmNsdWRlLmJpbmQoRSksaW5jbHVkZUZpbGU9RS5pbmNsdWRlRmlsZS5iaW5kKEUpO3RSKz0nSGkgJzt0Uis9RS5lKGl0LnVzZXIpO2lmKGNiKXtjYihudWxsLHRSKX0gcmV0dXJuIHRSXFxufVwiXHJcbiAqIGBgYFxyXG4gKi9cclxuZnVuY3Rpb24gY29tcGlsZShzdHIsIGNvbmZpZykge1xyXG4gICAgdmFyIG9wdGlvbnMgPSBnZXRDb25maWcoY29uZmlnIHx8IHt9KTtcclxuICAgIC8qIEFTWU5DIEhBTkRMSU5HICovXHJcbiAgICAvLyBUaGUgYmVsb3cgY29kZSBpcyBtb2RpZmllZCBmcm9tIG1kZS9lanMuIEFsbCBjcmVkaXQgc2hvdWxkIGdvIHRvIHRoZW0uXHJcbiAgICB2YXIgY3RvciA9IG9wdGlvbnMuYXN5bmMgPyBnZXRBc3luY0Z1bmN0aW9uQ29uc3RydWN0b3IoKSA6IEZ1bmN0aW9uO1xyXG4gICAgLyogRU5EIEFTWU5DIEhBTkRMSU5HICovXHJcbiAgICB0cnkge1xyXG4gICAgICAgIHJldHVybiBuZXcgY3RvcihvcHRpb25zLnZhck5hbWUsICdFJywgLy8gRXRhQ29uZmlnXHJcbiAgICAgICAgJ2NiJywgLy8gb3B0aW9uYWwgY2FsbGJhY2tcclxuICAgICAgICBjb21waWxlVG9TdHJpbmcoc3RyLCBvcHRpb25zKSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcclxuICAgIH1cclxuICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xyXG4gICAgICAgICAgICB0aHJvdyBFdGFFcnIoJ0JhZCB0ZW1wbGF0ZSBzeW50YXhcXG5cXG4nICtcclxuICAgICAgICAgICAgICAgIGUubWVzc2FnZSArXHJcbiAgICAgICAgICAgICAgICAnXFxuJyArXHJcbiAgICAgICAgICAgICAgICBBcnJheShlLm1lc3NhZ2UubGVuZ3RoICsgMSkuam9pbignPScpICtcclxuICAgICAgICAgICAgICAgICdcXG4nICtcclxuICAgICAgICAgICAgICAgIGNvbXBpbGVUb1N0cmluZyhzdHIsIG9wdGlvbnMpICtcclxuICAgICAgICAgICAgICAgICdcXG4nIC8vIFRoaXMgd2lsbCBwdXQgYW4gZXh0cmEgbmV3bGluZSBiZWZvcmUgdGhlIGNhbGxzdGFjayBmb3IgZXh0cmEgcmVhZGFiaWxpdHlcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRocm93IGU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XG5cbnZhciBfQk9NID0gL15cXHVGRUZGLztcclxuLyogRU5EIFRZUEVTICovXHJcbi8qKlxyXG4gKiBHZXQgdGhlIHBhdGggdG8gdGhlIGluY2x1ZGVkIGZpbGUgZnJvbSB0aGUgcGFyZW50IGZpbGUgcGF0aCBhbmQgdGhlXHJcbiAqIHNwZWNpZmllZCBwYXRoLlxyXG4gKlxyXG4gKiBJZiBgbmFtZWAgZG9lcyBub3QgaGF2ZSBhbiBleHRlbnNpb24sIGl0IHdpbGwgZGVmYXVsdCB0byBgLmV0YWBcclxuICpcclxuICogQHBhcmFtIG5hbWUgc3BlY2lmaWVkIHBhdGhcclxuICogQHBhcmFtIHBhcmVudGZpbGUgcGFyZW50IGZpbGUgcGF0aFxyXG4gKiBAcGFyYW0gaXNEaXJlY3Rvcnkgd2hldGhlciBwYXJlbnRmaWxlIGlzIGEgZGlyZWN0b3J5XHJcbiAqIEByZXR1cm4gYWJzb2x1dGUgcGF0aCB0byB0ZW1wbGF0ZVxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0V2hvbGVGaWxlUGF0aChuYW1lLCBwYXJlbnRmaWxlLCBpc0RpcmVjdG9yeSkge1xyXG4gICAgdmFyIGluY2x1ZGVQYXRoID0gcGF0aC5yZXNvbHZlKGlzRGlyZWN0b3J5ID8gcGFyZW50ZmlsZSA6IHBhdGguZGlybmFtZShwYXJlbnRmaWxlKSwgLy8gcmV0dXJucyBkaXJlY3RvcnkgdGhlIHBhcmVudCBmaWxlIGlzIGluXHJcbiAgICBuYW1lIC8vIGZpbGVcclxuICAgICkgKyAocGF0aC5leHRuYW1lKG5hbWUpID8gJycgOiAnLmV0YScpO1xyXG4gICAgcmV0dXJuIGluY2x1ZGVQYXRoO1xyXG59XHJcbi8qKlxyXG4gKiBHZXQgdGhlIGFic29sdXRlIHBhdGggdG8gYW4gaW5jbHVkZWQgdGVtcGxhdGVcclxuICpcclxuICogSWYgdGhpcyBpcyBjYWxsZWQgd2l0aCBhbiBhYnNvbHV0ZSBwYXRoIChmb3IgZXhhbXBsZSwgc3RhcnRpbmcgd2l0aCAnLycgb3IgJ0M6XFwnKVxyXG4gKiB0aGVuIEV0YSB3aWxsIGF0dGVtcHQgdG8gcmVzb2x2ZSB0aGUgYWJzb2x1dGUgcGF0aCB3aXRoaW4gb3B0aW9ucy52aWV3cy4gSWYgaXQgY2Fubm90LFxyXG4gKiBFdGEgd2lsbCBmYWxsYmFjayB0byBvcHRpb25zLnJvb3Qgb3IgJy8nXHJcbiAqXHJcbiAqIElmIHRoaXMgaXMgY2FsbGVkIHdpdGggYSByZWxhdGl2ZSBwYXRoLCBFdGEgd2lsbDpcclxuICogLSBMb29rIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHRlbXBsYXRlIChpZiB0aGUgY3VycmVudCB0ZW1wbGF0ZSBoYXMgdGhlIGBmaWxlbmFtZWAgcHJvcGVydHkpXHJcbiAqIC0gTG9vayBpbnNpZGUgZWFjaCBkaXJlY3RvcnkgaW4gb3B0aW9ucy52aWV3c1xyXG4gKlxyXG4gKiBOb3RlOiBpZiBFdGEgaXMgdW5hYmxlIHRvIGZpbmQgYSB0ZW1wbGF0ZSB1c2luZyBwYXRoIGFuZCBvcHRpb25zLCBpdCB3aWxsIHRocm93IGFuIGVycm9yLlxyXG4gKlxyXG4gKiBAcGFyYW0gcGF0aCAgICBzcGVjaWZpZWQgcGF0aFxyXG4gKiBAcGFyYW0gb3B0aW9ucyBjb21waWxhdGlvbiBvcHRpb25zXHJcbiAqIEByZXR1cm4gYWJzb2x1dGUgcGF0aCB0byB0ZW1wbGF0ZVxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0UGF0aChwYXRoLCBvcHRpb25zKSB7XHJcbiAgICB2YXIgaW5jbHVkZVBhdGggPSBmYWxzZTtcclxuICAgIHZhciB2aWV3cyA9IG9wdGlvbnMudmlld3M7XHJcbiAgICB2YXIgc2VhcmNoZWRQYXRocyA9IFtdO1xyXG4gICAgLy8gSWYgdGhlc2UgZm91ciB2YWx1ZXMgYXJlIHRoZSBzYW1lLFxyXG4gICAgLy8gZ2V0UGF0aCgpIHdpbGwgcmV0dXJuIHRoZSBzYW1lIHJlc3VsdCBldmVyeSB0aW1lLlxyXG4gICAgLy8gV2UgY2FuIGNhY2hlIHRoZSByZXN1bHQgdG8gYXZvaWQgZXhwZW5zaXZlXHJcbiAgICAvLyBmaWxlIG9wZXJhdGlvbnMuXHJcbiAgICB2YXIgcGF0aE9wdGlvbnMgPSBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgZmlsZW5hbWU6IG9wdGlvbnMuZmlsZW5hbWUsXHJcbiAgICAgICAgcGF0aDogcGF0aCxcclxuICAgICAgICByb290OiBvcHRpb25zLnJvb3QsXHJcbiAgICAgICAgdmlld3M6IG9wdGlvbnMudmlld3NcclxuICAgIH0pO1xyXG4gICAgaWYgKG9wdGlvbnMuY2FjaGUgJiYgb3B0aW9ucy5maWxlcGF0aENhY2hlICYmIG9wdGlvbnMuZmlsZXBhdGhDYWNoZVtwYXRoT3B0aW9uc10pIHtcclxuICAgICAgICAvLyBVc2UgdGhlIGNhY2hlZCBmaWxlcGF0aFxyXG4gICAgICAgIHJldHVybiBvcHRpb25zLmZpbGVwYXRoQ2FjaGVbcGF0aE9wdGlvbnNdO1xyXG4gICAgfVxyXG4gICAgLyoqIEFkZCBhIGZpbGVwYXRoIHRvIHRoZSBsaXN0IG9mIHBhdGhzIHdlJ3ZlIGNoZWNrZWQgZm9yIGEgdGVtcGxhdGUgKi9cclxuICAgIGZ1bmN0aW9uIGFkZFBhdGhUb1NlYXJjaGVkKHBhdGhTZWFyY2hlZCkge1xyXG4gICAgICAgIGlmICghc2VhcmNoZWRQYXRocy5pbmNsdWRlcyhwYXRoU2VhcmNoZWQpKSB7XHJcbiAgICAgICAgICAgIHNlYXJjaGVkUGF0aHMucHVzaChwYXRoU2VhcmNoZWQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVGFrZSBhIGZpbGVwYXRoIChsaWtlICdwYXJ0aWFscy9teXBhcnRpYWwuZXRhJykuIEF0dGVtcHQgdG8gZmluZCB0aGUgdGVtcGxhdGUgZmlsZSBpbnNpZGUgYHZpZXdzYDtcclxuICAgICAqIHJldHVybiB0aGUgcmVzdWx0aW5nIHRlbXBsYXRlIGZpbGUgcGF0aCwgb3IgYGZhbHNlYCB0byBpbmRpY2F0ZSB0aGF0IHRoZSB0ZW1wbGF0ZSB3YXMgbm90IGZvdW5kLlxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB2aWV3cyB0aGUgZmlsZXBhdGggdGhhdCBob2xkcyB0ZW1wbGF0ZXMsIG9yIGFuIGFycmF5IG9mIGZpbGVwYXRocyB0aGF0IGhvbGQgdGVtcGxhdGVzXHJcbiAgICAgKiBAcGFyYW0gcGF0aCB0aGUgcGF0aCB0byB0aGUgdGVtcGxhdGVcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gc2VhcmNoVmlld3Modmlld3MsIHBhdGgpIHtcclxuICAgICAgICB2YXIgZmlsZVBhdGg7XHJcbiAgICAgICAgLy8gSWYgdmlld3MgaXMgYW4gYXJyYXksIHRoZW4gbG9vcCB0aHJvdWdoIGVhY2ggZGlyZWN0b3J5XHJcbiAgICAgICAgLy8gQW5kIGF0dGVtcHQgdG8gZmluZCB0aGUgdGVtcGxhdGVcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2aWV3cykgJiZcclxuICAgICAgICAgICAgdmlld3Muc29tZShmdW5jdGlvbiAodikge1xyXG4gICAgICAgICAgICAgICAgZmlsZVBhdGggPSBnZXRXaG9sZUZpbGVQYXRoKHBhdGgsIHYsIHRydWUpO1xyXG4gICAgICAgICAgICAgICAgYWRkUGF0aFRvU2VhcmNoZWQoZmlsZVBhdGgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4aXN0c1N5bmMoZmlsZVBhdGgpO1xyXG4gICAgICAgICAgICB9KSkge1xyXG4gICAgICAgICAgICAvLyBJZiB0aGUgYWJvdmUgcmV0dXJuZWQgdHJ1ZSwgd2Uga25vdyB0aGF0IHRoZSBmaWxlUGF0aCB3YXMganVzdCBzZXQgdG8gYSBwYXRoXHJcbiAgICAgICAgICAgIC8vIFRoYXQgZXhpc3RzIChBcnJheS5zb21lKCkgcmV0dXJucyBhcyBzb29uIGFzIGl0IGZpbmRzIGEgdmFsaWQgZWxlbWVudClcclxuICAgICAgICAgICAgcmV0dXJuIGZpbGVQYXRoO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygdmlld3MgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIC8vIFNlYXJjaCBmb3IgdGhlIGZpbGUgaWYgdmlld3MgaXMgYSBzaW5nbGUgZGlyZWN0b3J5XHJcbiAgICAgICAgICAgIGZpbGVQYXRoID0gZ2V0V2hvbGVGaWxlUGF0aChwYXRoLCB2aWV3cywgdHJ1ZSk7XHJcbiAgICAgICAgICAgIGFkZFBhdGhUb1NlYXJjaGVkKGZpbGVQYXRoKTtcclxuICAgICAgICAgICAgaWYgKGV4aXN0c1N5bmMoZmlsZVBhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsZVBhdGg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gVW5hYmxlIHRvIGZpbmQgYSBmaWxlXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgLy8gUGF0aCBzdGFydHMgd2l0aCAnLycsICdDOlxcJywgZXRjLlxyXG4gICAgdmFyIG1hdGNoID0gL15bQS1aYS16XSs6XFxcXHxeXFwvLy5leGVjKHBhdGgpO1xyXG4gICAgLy8gQWJzb2x1dGUgcGF0aCwgbGlrZSAvcGFydGlhbHMvcGFydGlhbC5ldGFcclxuICAgIGlmIChtYXRjaCAmJiBtYXRjaC5sZW5ndGgpIHtcclxuICAgICAgICAvLyBXZSBoYXZlIHRvIHRyaW0gdGhlIGJlZ2lubmluZyAnLycgb2ZmIHRoZSBwYXRoLCBvciBlbHNlXHJcbiAgICAgICAgLy8gcGF0aC5yZXNvbHZlKGRpciwgcGF0aCkgd2lsbCBhbHdheXMgcmVzb2x2ZSB0byBqdXN0IHBhdGhcclxuICAgICAgICB2YXIgZm9ybWF0dGVkUGF0aCA9IHBhdGgucmVwbGFjZSgvXlxcLyovLCAnJyk7XHJcbiAgICAgICAgLy8gRmlyc3QsIHRyeSB0byByZXNvbHZlIHRoZSBwYXRoIHdpdGhpbiBvcHRpb25zLnZpZXdzXHJcbiAgICAgICAgaW5jbHVkZVBhdGggPSBzZWFyY2hWaWV3cyh2aWV3cywgZm9ybWF0dGVkUGF0aCk7XHJcbiAgICAgICAgaWYgKCFpbmNsdWRlUGF0aCkge1xyXG4gICAgICAgICAgICAvLyBJZiB0aGF0IGZhaWxzLCBzZWFyY2hWaWV3cyB3aWxsIHJldHVybiBmYWxzZS4gVHJ5IHRvIGZpbmQgdGhlIHBhdGhcclxuICAgICAgICAgICAgLy8gaW5zaWRlIG9wdGlvbnMucm9vdCAoYnkgZGVmYXVsdCAnLycsIHRoZSBiYXNlIG9mIHRoZSBmaWxlc3lzdGVtKVxyXG4gICAgICAgICAgICB2YXIgcGF0aEZyb21Sb290ID0gZ2V0V2hvbGVGaWxlUGF0aChmb3JtYXR0ZWRQYXRoLCBvcHRpb25zLnJvb3QgfHwgJy8nLCB0cnVlKTtcclxuICAgICAgICAgICAgYWRkUGF0aFRvU2VhcmNoZWQocGF0aEZyb21Sb290KTtcclxuICAgICAgICAgICAgaW5jbHVkZVBhdGggPSBwYXRoRnJvbVJvb3Q7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgLy8gUmVsYXRpdmUgcGF0aHNcclxuICAgICAgICAvLyBMb29rIHJlbGF0aXZlIHRvIGEgcGFzc2VkIGZpbGVuYW1lIGZpcnN0XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuZmlsZW5hbWUpIHtcclxuICAgICAgICAgICAgdmFyIGZpbGVQYXRoID0gZ2V0V2hvbGVGaWxlUGF0aChwYXRoLCBvcHRpb25zLmZpbGVuYW1lKTtcclxuICAgICAgICAgICAgYWRkUGF0aFRvU2VhcmNoZWQoZmlsZVBhdGgpO1xyXG4gICAgICAgICAgICBpZiAoZXhpc3RzU3luYyhmaWxlUGF0aCkpIHtcclxuICAgICAgICAgICAgICAgIGluY2x1ZGVQYXRoID0gZmlsZVBhdGg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gVGhlbiBsb29rIGZvciB0aGUgdGVtcGxhdGUgaW4gb3B0aW9ucy52aWV3c1xyXG4gICAgICAgIGlmICghaW5jbHVkZVBhdGgpIHtcclxuICAgICAgICAgICAgaW5jbHVkZVBhdGggPSBzZWFyY2hWaWV3cyh2aWV3cywgcGF0aCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghaW5jbHVkZVBhdGgpIHtcclxuICAgICAgICAgICAgdGhyb3cgRXRhRXJyKCdDb3VsZCBub3QgZmluZCB0aGUgdGVtcGxhdGUgXCInICsgcGF0aCArICdcIi4gUGF0aHMgdHJpZWQ6ICcgKyBzZWFyY2hlZFBhdGhzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBJZiBjYWNoaW5nIGFuZCBmaWxlcGF0aENhY2hlIGFyZSBlbmFibGVkLFxyXG4gICAgLy8gY2FjaGUgdGhlIGlucHV0ICYgb3V0cHV0IG9mIHRoaXMgZnVuY3Rpb24uXHJcbiAgICBpZiAob3B0aW9ucy5jYWNoZSAmJiBvcHRpb25zLmZpbGVwYXRoQ2FjaGUpIHtcclxuICAgICAgICBvcHRpb25zLmZpbGVwYXRoQ2FjaGVbcGF0aE9wdGlvbnNdID0gaW5jbHVkZVBhdGg7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gaW5jbHVkZVBhdGg7XHJcbn1cclxuLyoqXHJcbiAqIFJlYWRzIGEgZmlsZSBzeW5jaHJvbm91c2x5XHJcbiAqL1xyXG5mdW5jdGlvbiByZWFkRmlsZShmaWxlUGF0aCkge1xyXG4gICAgdHJ5IHtcclxuICAgICAgICByZXR1cm4gcmVhZEZpbGVTeW5jKGZpbGVQYXRoKS50b1N0cmluZygpLnJlcGxhY2UoX0JPTSwgJycpOyAvLyBUT0RPOiBpcyByZXBsYWNpbmcgQk9NJ3MgbmVjZXNzYXJ5P1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKF9hKSB7XHJcbiAgICAgICAgdGhyb3cgRXRhRXJyKFwiRmFpbGVkIHRvIHJlYWQgdGVtcGxhdGUgYXQgJ1wiICsgZmlsZVBhdGggKyBcIidcIik7XHJcbiAgICB9XHJcbn1cblxuLy8gZXhwcmVzcyBpcyBzZXQgbGlrZTogYXBwLmVuZ2luZSgnaHRtbCcsIHJlcXVpcmUoJ2V0YScpLnJlbmRlckZpbGUpXHJcbi8qIEVORCBUWVBFUyAqL1xyXG4vKipcclxuICogUmVhZHMgYSB0ZW1wbGF0ZSwgY29tcGlsZXMgaXQgaW50byBhIGZ1bmN0aW9uLCBjYWNoZXMgaXQgaWYgY2FjaGluZyBpc24ndCBkaXNhYmxlZCwgcmV0dXJucyB0aGUgZnVuY3Rpb25cclxuICpcclxuICogQHBhcmFtIGZpbGVQYXRoIEFic29sdXRlIHBhdGggdG8gdGVtcGxhdGUgZmlsZVxyXG4gKiBAcGFyYW0gb3B0aW9ucyBFdGEgY29uZmlndXJhdGlvbiBvdmVycmlkZXNcclxuICogQHBhcmFtIG5vQ2FjaGUgT3B0aW9uYWxseSwgbWFrZSBFdGEgbm90IGNhY2hlIHRoZSB0ZW1wbGF0ZVxyXG4gKi9cclxuZnVuY3Rpb24gbG9hZEZpbGUoZmlsZVBhdGgsIG9wdGlvbnMsIG5vQ2FjaGUpIHtcclxuICAgIHZhciBjb25maWcgPSBnZXRDb25maWcob3B0aW9ucyk7XHJcbiAgICB2YXIgdGVtcGxhdGUgPSByZWFkRmlsZShmaWxlUGF0aCk7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHZhciBjb21waWxlZFRlbXBsYXRlID0gY29tcGlsZSh0ZW1wbGF0ZSwgY29uZmlnKTtcclxuICAgICAgICBpZiAoIW5vQ2FjaGUpIHtcclxuICAgICAgICAgICAgY29uZmlnLnRlbXBsYXRlcy5kZWZpbmUoY29uZmlnLmZpbGVuYW1lLCBjb21waWxlZFRlbXBsYXRlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGNvbXBpbGVkVGVtcGxhdGU7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgIHRocm93IEV0YUVycignTG9hZGluZyBmaWxlOiAnICsgZmlsZVBhdGggKyAnIGZhaWxlZDpcXG5cXG4nICsgZS5tZXNzYWdlKTtcclxuICAgIH1cclxufVxyXG4vKipcclxuICogR2V0IHRoZSB0ZW1wbGF0ZSBmcm9tIGEgc3RyaW5nIG9yIGEgZmlsZSwgZWl0aGVyIGNvbXBpbGVkIG9uLXRoZS1mbHkgb3JcclxuICogcmVhZCBmcm9tIGNhY2hlIChpZiBlbmFibGVkKSwgYW5kIGNhY2hlIHRoZSB0ZW1wbGF0ZSBpZiBuZWVkZWQuXHJcbiAqXHJcbiAqIElmIGBvcHRpb25zLmNhY2hlYCBpcyB0cnVlLCB0aGlzIGZ1bmN0aW9uIHJlYWRzIHRoZSBmaWxlIGZyb21cclxuICogYG9wdGlvbnMuZmlsZW5hbWVgIHNvIGl0IG11c3QgYmUgc2V0IHByaW9yIHRvIGNhbGxpbmcgdGhpcyBmdW5jdGlvbi5cclxuICpcclxuICogQHBhcmFtIG9wdGlvbnMgICBjb21waWxhdGlvbiBvcHRpb25zXHJcbiAqIEByZXR1cm4gRXRhIHRlbXBsYXRlIGZ1bmN0aW9uXHJcbiAqL1xyXG5mdW5jdGlvbiBoYW5kbGVDYWNoZSQxKG9wdGlvbnMpIHtcclxuICAgIHZhciBmaWxlbmFtZSA9IG9wdGlvbnMuZmlsZW5hbWU7XHJcbiAgICBpZiAob3B0aW9ucy5jYWNoZSkge1xyXG4gICAgICAgIHZhciBmdW5jID0gb3B0aW9ucy50ZW1wbGF0ZXMuZ2V0KGZpbGVuYW1lKTtcclxuICAgICAgICBpZiAoZnVuYykge1xyXG4gICAgICAgICAgICByZXR1cm4gZnVuYztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGxvYWRGaWxlKGZpbGVuYW1lLCBvcHRpb25zKTtcclxuICAgIH1cclxuICAgIC8vIENhY2hpbmcgaXMgZGlzYWJsZWQsIHNvIHBhc3Mgbm9DYWNoZSA9IHRydWVcclxuICAgIHJldHVybiBsb2FkRmlsZShmaWxlbmFtZSwgb3B0aW9ucywgdHJ1ZSk7XHJcbn1cclxuLyoqXHJcbiAqIFRyeSBjYWxsaW5nIGhhbmRsZUNhY2hlIHdpdGggdGhlIGdpdmVuIG9wdGlvbnMgYW5kIGRhdGEgYW5kIGNhbGwgdGhlXHJcbiAqIGNhbGxiYWNrIHdpdGggdGhlIHJlc3VsdC4gSWYgYW4gZXJyb3Igb2NjdXJzLCBjYWxsIHRoZSBjYWxsYmFjayB3aXRoXHJcbiAqIHRoZSBlcnJvci4gVXNlZCBieSByZW5kZXJGaWxlKCkuXHJcbiAqXHJcbiAqIEBwYXJhbSBkYXRhIHRlbXBsYXRlIGRhdGFcclxuICogQHBhcmFtIG9wdGlvbnMgY29tcGlsYXRpb24gb3B0aW9uc1xyXG4gKiBAcGFyYW0gY2IgY2FsbGJhY2tcclxuICovXHJcbmZ1bmN0aW9uIHRyeUhhbmRsZUNhY2hlKGRhdGEsIG9wdGlvbnMsIGNiKSB7XHJcbiAgICBpZiAoY2IpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyBOb3RlOiBpZiB0aGVyZSBpcyBhbiBlcnJvciB3aGlsZSByZW5kZXJpbmcgdGhlIHRlbXBsYXRlLFxyXG4gICAgICAgICAgICAvLyBJdCB3aWxsIGJ1YmJsZSB1cCBhbmQgYmUgY2F1Z2h0IGhlcmVcclxuICAgICAgICAgICAgdmFyIHRlbXBsYXRlRm4gPSBoYW5kbGVDYWNoZSQxKG9wdGlvbnMpO1xyXG4gICAgICAgICAgICB0ZW1wbGF0ZUZuKGRhdGEsIG9wdGlvbnMsIGNiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICAvLyBObyBjYWxsYmFjaywgdHJ5IHJldHVybmluZyBhIHByb21pc2VcclxuICAgICAgICBpZiAodHlwZW9mIHByb21pc2VJbXBsID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgcHJvbWlzZUltcGwoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGVtcGxhdGVGbiA9IGhhbmRsZUNhY2hlJDEob3B0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHRlbXBsYXRlRm4oZGF0YSwgb3B0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRocm93IEV0YUVycihcIlBsZWFzZSBwcm92aWRlIGEgY2FsbGJhY2sgZnVuY3Rpb24sIHRoaXMgZW52IGRvZXNuJ3Qgc3VwcG9ydCBQcm9taXNlc1wiKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuLyoqXHJcbiAqIEdldCB0aGUgdGVtcGxhdGUgZnVuY3Rpb24uXHJcbiAqXHJcbiAqIElmIGBvcHRpb25zLmNhY2hlYCBpcyBgdHJ1ZWAsIHRoZW4gdGhlIHRlbXBsYXRlIGlzIGNhY2hlZC5cclxuICpcclxuICogVGhpcyByZXR1cm5zIGEgdGVtcGxhdGUgZnVuY3Rpb24gYW5kIHRoZSBjb25maWcgb2JqZWN0IHdpdGggd2hpY2ggdGhhdCB0ZW1wbGF0ZSBmdW5jdGlvbiBzaG91bGQgYmUgY2FsbGVkLlxyXG4gKlxyXG4gKiBAcmVtYXJrc1xyXG4gKlxyXG4gKiBJdCdzIGltcG9ydGFudCB0aGF0IHRoaXMgcmV0dXJucyBhIGNvbmZpZyBvYmplY3Qgd2l0aCBgZmlsZW5hbWVgIHNldC5cclxuICogT3RoZXJ3aXNlLCB0aGUgaW5jbHVkZWQgZmlsZSB3b3VsZCBub3QgYmUgYWJsZSB0byB1c2UgcmVsYXRpdmUgcGF0aHNcclxuICpcclxuICogQHBhcmFtIHBhdGggcGF0aCBmb3IgdGhlIHNwZWNpZmllZCBmaWxlIChpZiByZWxhdGl2ZSwgc3BlY2lmeSBgdmlld3NgIG9uIGBvcHRpb25zYClcclxuICogQHBhcmFtIG9wdGlvbnMgY29tcGlsYXRpb24gb3B0aW9uc1xyXG4gKiBAcmV0dXJuIFtFdGEgdGVtcGxhdGUgZnVuY3Rpb24sIG5ldyBjb25maWcgb2JqZWN0XVxyXG4gKi9cclxuZnVuY3Rpb24gaW5jbHVkZUZpbGUocGF0aCwgb3B0aW9ucykge1xyXG4gICAgLy8gdGhlIGJlbG93IGNyZWF0ZXMgYSBuZXcgb3B0aW9ucyBvYmplY3QsIHVzaW5nIHRoZSBwYXJlbnQgZmlsZXBhdGggb2YgdGhlIG9sZCBvcHRpb25zIG9iamVjdCBhbmQgdGhlIHBhdGhcclxuICAgIHZhciBuZXdGaWxlT3B0aW9ucyA9IGdldENvbmZpZyh7IGZpbGVuYW1lOiBnZXRQYXRoKHBhdGgsIG9wdGlvbnMpIH0sIG9wdGlvbnMpO1xyXG4gICAgLy8gVE9ETzogbWFrZSBzdXJlIHByb3BlcnRpZXMgYXJlIGN1cnJlY3RseSBjb3BpZWQgb3ZlclxyXG4gICAgcmV0dXJuIFtoYW5kbGVDYWNoZSQxKG5ld0ZpbGVPcHRpb25zKSwgbmV3RmlsZU9wdGlvbnNdO1xyXG59XHJcbmZ1bmN0aW9uIHJlbmRlckZpbGUoZmlsZW5hbWUsIGRhdGEsIGNvbmZpZywgY2IpIHtcclxuICAgIC8qXHJcbiAgICBIZXJlIHdlIGhhdmUgc29tZSBmdW5jdGlvbiBvdmVybG9hZGluZy5cclxuICAgIEVzc2VudGlhbGx5LCB0aGUgZmlyc3QgMiBhcmd1bWVudHMgdG8gcmVuZGVyRmlsZSBzaG91bGQgYWx3YXlzIGJlIHRoZSBmaWxlbmFtZSBhbmQgZGF0YVxyXG4gICAgSG93ZXZlciwgd2l0aCBFeHByZXNzLCBjb25maWd1cmF0aW9uIG9wdGlvbnMgd2lsbCBiZSBwYXNzZWQgYWxvbmcgd2l0aCB0aGUgZGF0YS5cclxuICAgIFRodXMsIEV4cHJlc3Mgd2lsbCBjYWxsIHJlbmRlckZpbGUgd2l0aCAoZmlsZW5hbWUsIGRhdGFBbmRPcHRpb25zLCBjYilcclxuICAgIEFuZCB3ZSB3YW50IHRvIGFsc28gbWFrZSAoZmlsZW5hbWUsIGRhdGEsIG9wdGlvbnMsIGNiKSBhdmFpbGFibGVcclxuICAgICovXHJcbiAgICB2YXIgcmVuZGVyQ29uZmlnO1xyXG4gICAgdmFyIGNhbGxiYWNrO1xyXG4gICAgZGF0YSA9IGRhdGEgfHwge307IC8vIElmIGRhdGEgaXMgdW5kZWZpbmVkLCB3ZSBkb24ndCB3YW50IGFjY2Vzc2luZyBkYXRhLnNldHRpbmdzIHRvIGVycm9yXHJcbiAgICAvLyBGaXJzdCwgYXNzaWduIG91ciBjYWxsYmFjayBmdW5jdGlvbiB0byBgY2FsbGJhY2tgXHJcbiAgICAvLyBXZSBjYW4gbGVhdmUgaXQgdW5kZWZpbmVkIGlmIG5laXRoZXIgcGFyYW1ldGVyIGlzIGEgZnVuY3Rpb247XHJcbiAgICAvLyBDYWxsYmFja3MgYXJlIG9wdGlvbmFsXHJcbiAgICBpZiAodHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgLy8gVGhlIDR0aCBhcmd1bWVudCBpcyB0aGUgY2FsbGJhY2tcclxuICAgICAgICBjYWxsYmFjayA9IGNiO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIC8vIFRoZSAzcmQgYXJnIGlzIHRoZSBjYWxsYmFja1xyXG4gICAgICAgIGNhbGxiYWNrID0gY29uZmlnO1xyXG4gICAgfVxyXG4gICAgLy8gSWYgdGhlcmUgaXMgYSBjb25maWcgb2JqZWN0IHBhc3NlZCBpbiBleHBsaWNpdGx5LCB1c2UgaXRcclxuICAgIGlmICh0eXBlb2YgY29uZmlnID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIHJlbmRlckNvbmZpZyA9IGdldENvbmZpZyhjb25maWcgfHwge30pO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgLy8gT3RoZXJ3aXNlLCBnZXQgdGhlIGNvbmZpZyBmcm9tIHRoZSBkYXRhIG9iamVjdFxyXG4gICAgICAgIC8vIEFuZCB0aGVuIGdyYWIgc29tZSBjb25maWcgb3B0aW9ucyBmcm9tIGRhdGEuc2V0dGluZ3NcclxuICAgICAgICAvLyBXaGljaCBpcyB3aGVyZSBFeHByZXNzIHNvbWV0aW1lcyBzdG9yZXMgdGhlbVxyXG4gICAgICAgIHJlbmRlckNvbmZpZyA9IGdldENvbmZpZyhkYXRhKTtcclxuICAgICAgICBpZiAoZGF0YS5zZXR0aW5ncykge1xyXG4gICAgICAgICAgICAvLyBQdWxsIGEgZmV3IHRoaW5ncyBmcm9tIGtub3duIGxvY2F0aW9uc1xyXG4gICAgICAgICAgICBpZiAoZGF0YS5zZXR0aW5ncy52aWV3cykge1xyXG4gICAgICAgICAgICAgICAgcmVuZGVyQ29uZmlnLnZpZXdzID0gZGF0YS5zZXR0aW5ncy52aWV3cztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoZGF0YS5zZXR0aW5nc1sndmlldyBjYWNoZSddKSB7XHJcbiAgICAgICAgICAgICAgICByZW5kZXJDb25maWcuY2FjaGUgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIFVuZG9jdW1lbnRlZCBhZnRlciBFeHByZXNzIDIsIGJ1dCBzdGlsbCB1c2FibGUsIGVzcC4gZm9yXHJcbiAgICAgICAgICAgIC8vIGl0ZW1zIHRoYXQgYXJlIHVuc2FmZSB0byBiZSBwYXNzZWQgYWxvbmcgd2l0aCBkYXRhLCBsaWtlIGByb290YFxyXG4gICAgICAgICAgICB2YXIgdmlld09wdHMgPSBkYXRhLnNldHRpbmdzWyd2aWV3IG9wdGlvbnMnXTtcclxuICAgICAgICAgICAgaWYgKHZpZXdPcHRzKSB7XHJcbiAgICAgICAgICAgICAgICBjb3B5UHJvcHMocmVuZGVyQ29uZmlnLCB2aWV3T3B0cyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBTZXQgdGhlIGZpbGVuYW1lIG9wdGlvbiBvbiB0aGUgdGVtcGxhdGVcclxuICAgIC8vIFRoaXMgd2lsbCBmaXJzdCB0cnkgdG8gcmVzb2x2ZSB0aGUgZmlsZSBwYXRoIChzZWUgZ2V0UGF0aCBmb3IgZGV0YWlscylcclxuICAgIHJlbmRlckNvbmZpZy5maWxlbmFtZSA9IGdldFBhdGgoZmlsZW5hbWUsIHJlbmRlckNvbmZpZyk7XHJcbiAgICByZXR1cm4gdHJ5SGFuZGxlQ2FjaGUoZGF0YSwgcmVuZGVyQ29uZmlnLCBjYWxsYmFjayk7XHJcbn1cclxuZnVuY3Rpb24gcmVuZGVyRmlsZUFzeW5jKGZpbGVuYW1lLCBkYXRhLCBjb25maWcsIGNiKSB7XHJcbiAgICByZXR1cm4gcmVuZGVyRmlsZShmaWxlbmFtZSwgdHlwZW9mIGNvbmZpZyA9PT0gJ2Z1bmN0aW9uJyA/IF9fYXNzaWduKF9fYXNzaWduKHt9LCBkYXRhKSwgeyBhc3luYzogdHJ1ZSB9KSA6IGRhdGEsIHR5cGVvZiBjb25maWcgPT09ICdvYmplY3QnID8gX19hc3NpZ24oX19hc3NpZ24oe30sIGNvbmZpZyksIHsgYXN5bmM6IHRydWUgfSkgOiBjb25maWcsIGNiKTtcclxufVxuXG4vKiBFTkQgVFlQRVMgKi9cclxuLyoqXHJcbiAqIENhbGxlZCB3aXRoIGBpbmNsdWRlRmlsZShwYXRoLCBkYXRhKWBcclxuICovXHJcbmZ1bmN0aW9uIGluY2x1ZGVGaWxlSGVscGVyKHBhdGgsIGRhdGEpIHtcclxuICAgIHZhciB0ZW1wbGF0ZUFuZENvbmZpZyA9IGluY2x1ZGVGaWxlKHBhdGgsIHRoaXMpO1xyXG4gICAgcmV0dXJuIHRlbXBsYXRlQW5kQ29uZmlnWzBdKGRhdGEsIHRlbXBsYXRlQW5kQ29uZmlnWzFdKTtcclxufVxuXG4vKiBFTkQgVFlQRVMgKi9cclxuZnVuY3Rpb24gaGFuZGxlQ2FjaGUodGVtcGxhdGUsIG9wdGlvbnMpIHtcclxuICAgIGlmIChvcHRpb25zLmNhY2hlICYmIG9wdGlvbnMubmFtZSAmJiBvcHRpb25zLnRlbXBsYXRlcy5nZXQob3B0aW9ucy5uYW1lKSkge1xyXG4gICAgICAgIHJldHVybiBvcHRpb25zLnRlbXBsYXRlcy5nZXQob3B0aW9ucy5uYW1lKTtcclxuICAgIH1cclxuICAgIHZhciB0ZW1wbGF0ZUZ1bmMgPSB0eXBlb2YgdGVtcGxhdGUgPT09ICdmdW5jdGlvbicgPyB0ZW1wbGF0ZSA6IGNvbXBpbGUodGVtcGxhdGUsIG9wdGlvbnMpO1xyXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IGhhdmUgdG8gY2hlY2sgaWYgaXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGNhY2hlO1xyXG4gICAgLy8gaXQgd291bGQgaGF2ZSByZXR1cm5lZCBlYXJsaWVyIGlmIGl0IGhhZFxyXG4gICAgaWYgKG9wdGlvbnMuY2FjaGUgJiYgb3B0aW9ucy5uYW1lKSB7XHJcbiAgICAgICAgb3B0aW9ucy50ZW1wbGF0ZXMuZGVmaW5lKG9wdGlvbnMubmFtZSwgdGVtcGxhdGVGdW5jKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0ZW1wbGF0ZUZ1bmM7XHJcbn1cclxuLyoqXHJcbiAqIFJlbmRlciBhIHRlbXBsYXRlXHJcbiAqXHJcbiAqIElmIGB0ZW1wbGF0ZWAgaXMgYSBzdHJpbmcsIEV0YSB3aWxsIGNvbXBpbGUgaXQgdG8gYSBmdW5jdGlvbiBhbmQgdGhlbiBjYWxsIGl0IHdpdGggdGhlIHByb3ZpZGVkIGRhdGEuXHJcbiAqIElmIGB0ZW1wbGF0ZWAgaXMgYSB0ZW1wbGF0ZSBmdW5jdGlvbiwgRXRhIHdpbGwgY2FsbCBpdCB3aXRoIHRoZSBwcm92aWRlZCBkYXRhLlxyXG4gKlxyXG4gKiBJZiBgY29uZmlnLmFzeW5jYCBpcyBgZmFsc2VgLCBFdGEgd2lsbCByZXR1cm4gdGhlIHJlbmRlcmVkIHRlbXBsYXRlLlxyXG4gKlxyXG4gKiBJZiBgY29uZmlnLmFzeW5jYCBpcyBgdHJ1ZWAgYW5kIHRoZXJlJ3MgYSBjYWxsYmFjayBmdW5jdGlvbiwgRXRhIHdpbGwgY2FsbCB0aGUgY2FsbGJhY2sgd2l0aCBgKGVyciwgcmVuZGVyZWRUZW1wbGF0ZSlgLlxyXG4gKiBJZiBgY29uZmlnLmFzeW5jYCBpcyBgdHJ1ZWAgYW5kIHRoZXJlJ3Mgbm90IGEgY2FsbGJhY2sgZnVuY3Rpb24sIEV0YSB3aWxsIHJldHVybiBhIFByb21pc2UgdGhhdCByZXNvbHZlcyB0byB0aGUgcmVuZGVyZWQgdGVtcGxhdGUuXHJcbiAqXHJcbiAqIElmIGBjb25maWcuY2FjaGVgIGlzIGB0cnVlYCBhbmQgYGNvbmZpZ2AgaGFzIGEgYG5hbWVgIG9yIGBmaWxlbmFtZWAgcHJvcGVydHksIEV0YSB3aWxsIGNhY2hlIHRoZSB0ZW1wbGF0ZSBvbiB0aGUgZmlyc3QgcmVuZGVyIGFuZCB1c2UgdGhlIGNhY2hlZCB0ZW1wbGF0ZSBmb3IgYWxsIHN1YnNlcXVlbnQgcmVuZGVycy5cclxuICpcclxuICogQHBhcmFtIHRlbXBsYXRlIFRlbXBsYXRlIHN0cmluZyBvciB0ZW1wbGF0ZSBmdW5jdGlvblxyXG4gKiBAcGFyYW0gZGF0YSBEYXRhIHRvIHJlbmRlciB0aGUgdGVtcGxhdGUgd2l0aFxyXG4gKiBAcGFyYW0gY29uZmlnIE9wdGlvbmFsIGNvbmZpZyBvcHRpb25zXHJcbiAqIEBwYXJhbSBjYiBDYWxsYmFjayBmdW5jdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gcmVuZGVyKHRlbXBsYXRlLCBkYXRhLCBjb25maWcsIGNiKSB7XHJcbiAgICB2YXIgb3B0aW9ucyA9IGdldENvbmZpZyhjb25maWcgfHwge30pO1xyXG4gICAgaWYgKG9wdGlvbnMuYXN5bmMpIHtcclxuICAgICAgICBpZiAoY2IpIHtcclxuICAgICAgICAgICAgLy8gSWYgdXNlciBwYXNzZXMgY2FsbGJhY2tcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIC8vIE5vdGU6IGlmIHRoZXJlIGlzIGFuIGVycm9yIHdoaWxlIHJlbmRlcmluZyB0aGUgdGVtcGxhdGUsXHJcbiAgICAgICAgICAgICAgICAvLyBJdCB3aWxsIGJ1YmJsZSB1cCBhbmQgYmUgY2F1Z2h0IGhlcmVcclxuICAgICAgICAgICAgICAgIHZhciB0ZW1wbGF0ZUZuID0gaGFuZGxlQ2FjaGUodGVtcGxhdGUsIG9wdGlvbnMpO1xyXG4gICAgICAgICAgICAgICAgdGVtcGxhdGVGbihkYXRhLCBvcHRpb25zLCBjYik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNiKGVycik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIE5vIGNhbGxiYWNrLCB0cnkgcmV0dXJuaW5nIGEgcHJvbWlzZVxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHByb21pc2VJbXBsID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IHByb21pc2VJbXBsKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGhhbmRsZUNhY2hlKHRlbXBsYXRlLCBvcHRpb25zKShkYXRhLCBvcHRpb25zKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBFdGFFcnIoXCJQbGVhc2UgcHJvdmlkZSBhIGNhbGxiYWNrIGZ1bmN0aW9uLCB0aGlzIGVudiBkb2Vzbid0IHN1cHBvcnQgUHJvbWlzZXNcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICByZXR1cm4gaGFuZGxlQ2FjaGUodGVtcGxhdGUsIG9wdGlvbnMpKGRhdGEsIG9wdGlvbnMpO1xyXG4gICAgfVxyXG59XHJcbi8qKlxyXG4gKiBSZW5kZXIgYSB0ZW1wbGF0ZSBhc3luY2hyb25vdXNseVxyXG4gKlxyXG4gKiBJZiBgdGVtcGxhdGVgIGlzIGEgc3RyaW5nLCBFdGEgd2lsbCBjb21waWxlIGl0IHRvIGEgZnVuY3Rpb24gYW5kIGNhbGwgaXQgd2l0aCB0aGUgcHJvdmlkZWQgZGF0YS5cclxuICogSWYgYHRlbXBsYXRlYCBpcyBhIGZ1bmN0aW9uLCBFdGEgd2lsbCBjYWxsIGl0IHdpdGggdGhlIHByb3ZpZGVkIGRhdGEuXHJcbiAqXHJcbiAqIElmIHRoZXJlIGlzIGEgY2FsbGJhY2sgZnVuY3Rpb24sIEV0YSB3aWxsIGNhbGwgaXQgd2l0aCBgKGVyciwgcmVuZGVyZWRUZW1wbGF0ZSlgLlxyXG4gKiBJZiB0aGVyZSBpcyBub3QgYSBjYWxsYmFjayBmdW5jdGlvbiwgRXRhIHdpbGwgcmV0dXJuIGEgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRoZSByZW5kZXJlZCB0ZW1wbGF0ZVxyXG4gKlxyXG4gKiBAcGFyYW0gdGVtcGxhdGUgVGVtcGxhdGUgc3RyaW5nIG9yIHRlbXBsYXRlIGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSBkYXRhIERhdGEgdG8gcmVuZGVyIHRoZSB0ZW1wbGF0ZSB3aXRoXHJcbiAqIEBwYXJhbSBjb25maWcgT3B0aW9uYWwgY29uZmlnIG9wdGlvbnNcclxuICogQHBhcmFtIGNiIENhbGxiYWNrIGZ1bmN0aW9uXHJcbiAqL1xyXG5mdW5jdGlvbiByZW5kZXJBc3luYyh0ZW1wbGF0ZSwgZGF0YSwgY29uZmlnLCBjYikge1xyXG4gICAgLy8gVXNpbmcgT2JqZWN0LmFzc2lnbiB0byBsb3dlciBidW5kbGUgc2l6ZSwgdXNpbmcgc3ByZWFkIG9wZXJhdG9yIG1ha2VzIGl0IGxhcmdlciBiZWNhdXNlIG9mIHR5cGVzY3JpcHQgaW5qZWN0ZWQgcG9seWZpbGxzXHJcbiAgICByZXR1cm4gcmVuZGVyKHRlbXBsYXRlLCBkYXRhLCBPYmplY3QuYXNzaWduKHt9LCBjb25maWcsIHsgYXN5bmM6IHRydWUgfSksIGNiKTtcclxufVxuXG4vLyBAZGVub2lmeS1pZ25vcmVcclxuY29uZmlnLmluY2x1ZGVGaWxlID0gaW5jbHVkZUZpbGVIZWxwZXI7XHJcbmNvbmZpZy5maWxlcGF0aENhY2hlID0ge307XG5cbmV4cG9ydCB7IHJlbmRlckZpbGUgYXMgX19leHByZXNzLCBjb21waWxlLCBjb21waWxlVG9TdHJpbmcsIGNvbmZpZywgY29uZmlndXJlLCBjb25maWcgYXMgZGVmYXVsdENvbmZpZywgZ2V0Q29uZmlnLCBsb2FkRmlsZSwgcGFyc2UsIHJlbmRlciwgcmVuZGVyQXN5bmMsIHJlbmRlckZpbGUsIHJlbmRlckZpbGVBc3luYywgdGVtcGxhdGVzIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1ldGEuZXMuanMubWFwXG4iLCJpbXBvcnQgeyBBcHAsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBUUGFyc2VyIHtcbiAgICBjb25zdHJ1Y3RvcihwdWJsaWMgYXBwOiBBcHApIHt9XG4gICAgYWJzdHJhY3QgZ2VuZXJhdGVDb250ZXh0KGZpbGU6IFRGaWxlKTogUHJvbWlzZTxhbnk+O1xufSIsImltcG9ydCBUZW1wbGF0ZXJQbHVnaW4gZnJvbSBcIm1haW5cIjtcbmltcG9ydCB7IEFwcCwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IFRQYXJzZXIgfSBmcm9tIFwiVFBhcnNlclwiO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSW50ZXJuYWxNb2R1bGUgZXh0ZW5kcyBUUGFyc2VyIHtcbiAgICBwcm90ZWN0ZWQgYWJzdHJhY3QgbmFtZTogc3RyaW5nO1xuICAgIHByb3RlY3RlZCBzdGF0aWNfdGVtcGxhdGVzOiBNYXA8c3RyaW5nLCBhbnk+ID0gbmV3IE1hcCgpO1xuICAgIHByb3RlY3RlZCBkeW5hbWljX3RlbXBsYXRlczogTWFwPHN0cmluZywgYW55PiA9IG5ldyBNYXAoKTtcbiAgICBwcm90ZWN0ZWQgZmlsZTogVEZpbGU7XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJvdGVjdGVkIHBsdWdpbjogVGVtcGxhdGVyUGx1Z2luKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG4gICAgfVxuXG4gICAgZ2V0TmFtZSgpOiBTdHJpbmcge1xuICAgICAgICByZXR1cm4gdGhpcy5uYW1lXG4gICAgfVxuXG4gICAgYWJzdHJhY3QgY3JlYXRlU3RhdGljVGVtcGxhdGVzKCk6IFByb21pc2U8dm9pZD47XG4gICAgYWJzdHJhY3QgdXBkYXRlVGVtcGxhdGVzKCk6IFByb21pc2U8dm9pZD47XG5cbiAgICBhc3luYyBnZW5lcmF0ZUNvbnRleHQoZmlsZTogVEZpbGUpIHtcbiAgICAgICAgdGhpcy5maWxlID0gZmlsZTtcblxuICAgICAgICBpZiAodGhpcy5zdGF0aWNfdGVtcGxhdGVzLnNpemUgPT09IDApIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlU3RhdGljVGVtcGxhdGVzKCk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVUZW1wbGF0ZXMoKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uT2JqZWN0LmZyb21FbnRyaWVzKHRoaXMuc3RhdGljX3RlbXBsYXRlcyksXG4gICAgICAgICAgICAuLi5PYmplY3QuZnJvbUVudHJpZXModGhpcy5keW5hbWljX3RlbXBsYXRlcyksXG4gICAgICAgIH1cbiAgICB9XG59IiwiaW1wb3J0IHsgSW50ZXJuYWxNb2R1bGUgfSBmcm9tIFwiLi4vSW50ZXJuYWxNb2R1bGVcIjtcblxuZXhwb3J0IGNsYXNzIEludGVybmFsTW9kdWxlRGF0ZSBleHRlbmRzIEludGVybmFsTW9kdWxlIHtcbiAgICBuYW1lID0gXCJkYXRlXCI7XG5cbiAgICBhc3luYyBjcmVhdGVTdGF0aWNUZW1wbGF0ZXMoKSB7XG4gICAgICAgIHRoaXMuc3RhdGljX3RlbXBsYXRlcy5zZXQoXCJub3dcIiwgdGhpcy5nZW5lcmF0ZV9ub3coKSk7XG4gICAgICAgIHRoaXMuc3RhdGljX3RlbXBsYXRlcy5zZXQoXCJ0b21vcnJvd1wiLCB0aGlzLmdlbmVyYXRlX3RvbW9ycm93KCkpO1xuICAgICAgICB0aGlzLnN0YXRpY190ZW1wbGF0ZXMuc2V0KFwid2Vla2RheVwiLCB0aGlzLmdlbmVyYXRlX3dlZWtkYXkoKSk7XG4gICAgICAgIHRoaXMuc3RhdGljX3RlbXBsYXRlcy5zZXQoXCJ5ZXN0ZXJkYXlcIiwgdGhpcy5nZW5lcmF0ZV95ZXN0ZXJkYXkoKSk7XG4gICAgfVxuXG4gICAgYXN5bmMgdXBkYXRlVGVtcGxhdGVzKCkge31cblxuICAgIGdlbmVyYXRlX25vdygpIHtcbiAgICAgICAgcmV0dXJuIChmb3JtYXQ6IHN0cmluZyA9IFwiWVlZWS1NTS1ERFwiLCBvZmZzZXQ/OiBudW1iZXJ8c3RyaW5nLCByZWZlcmVuY2U/OiBzdHJpbmcsIHJlZmVyZW5jZV9mb3JtYXQ/OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGlmIChyZWZlcmVuY2UgJiYgIXdpbmRvdy5tb21lbnQocmVmZXJlbmNlLCByZWZlcmVuY2VfZm9ybWF0KS5pc1ZhbGlkKCkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHJlZmVyZW5jZSBkYXRlIGZvcm1hdCwgdHJ5IHNwZWNpZnlpbmcgb25lIHdpdGggdGhlIGFyZ3VtZW50ICdyZWZlcmVuY2VfZm9ybWF0J1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBkdXJhdGlvbjtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgZHVyYXRpb24gPSB3aW5kb3cubW9tZW50LmR1cmF0aW9uKG9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgZHVyYXRpb24gPSB3aW5kb3cubW9tZW50LmR1cmF0aW9uKG9mZnNldCwgXCJkYXlzXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gd2luZG93Lm1vbWVudChyZWZlcmVuY2UsIHJlZmVyZW5jZV9mb3JtYXQpLmFkZChkdXJhdGlvbikuZm9ybWF0KGZvcm1hdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV90b21vcnJvdygpIHtcbiAgICAgICAgcmV0dXJuIChmb3JtYXQ6IHN0cmluZyA9IFwiWVlZWS1NTS1ERFwiKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gd2luZG93Lm1vbWVudCgpLmFkZCgxLCAnZGF5cycpLmZvcm1hdChmb3JtYXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfd2Vla2RheSgpIHtcbiAgICAgICAgcmV0dXJuIChmb3JtYXQ6IHN0cmluZyA9IFwiWVlZWS1NTS1ERFwiLCB3ZWVrZGF5OiBudW1iZXIsIHJlZmVyZW5jZT86IHN0cmluZywgcmVmZXJlbmNlX2Zvcm1hdD86IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgaWYgKHJlZmVyZW5jZSAmJiAhd2luZG93Lm1vbWVudChyZWZlcmVuY2UsIHJlZmVyZW5jZV9mb3JtYXQpLmlzVmFsaWQoKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgcmVmZXJlbmNlIGRhdGUgZm9ybWF0LCB0cnkgc3BlY2lmeWluZyBvbmUgd2l0aCB0aGUgYXJndW1lbnQgJ3JlZmVyZW5jZV9mb3JtYXQnXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHdpbmRvdy5tb21lbnQocmVmZXJlbmNlLCByZWZlcmVuY2VfZm9ybWF0KS53ZWVrZGF5KHdlZWtkYXkpLmZvcm1hdChmb3JtYXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfeWVzdGVyZGF5KCkge1xuICAgICAgICByZXR1cm4gKGZvcm1hdDogc3RyaW5nID0gXCJZWVlZLU1NLUREXCIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB3aW5kb3cubW9tZW50KCkuYWRkKC0xLCAnZGF5cycpLmZvcm1hdChmb3JtYXQpO1xuICAgICAgICB9XG4gICAgfVxufSIsImV4cG9ydCBjb25zdCBVTlNVUFBPUlRFRF9NT0JJTEVfVEVNUExBVEU6IHN0cmluZyA9IFwiRXJyb3JfTW9iaWxlVW5zdXBwb3J0ZWRUZW1wbGF0ZVwiO1xuZXhwb3J0IGNvbnN0IElDT05fREFUQTogc3RyaW5nID0gYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgNTEuMTMyOCAyOC43XCI+PHBhdGggZD1cIk0wIDE1LjE0IDAgMTAuMTUgMTguNjcgMS41MSAxOC42NyA2LjAzIDQuNzIgMTIuMzMgNC43MiAxMi43NiAxOC42NyAxOS4yMiAxOC42NyAyMy43NCAwIDE1LjE0Wk0zMy42OTI4IDEuODRDMzMuNjkyOCAxLjg0IDMzLjk3NjEgMi4xNDY3IDM0LjU0MjggMi43NkMzNS4xMDk0IDMuMzggMzUuMzkyOCA0LjU2IDM1LjM5MjggNi4zQzM1LjM5MjggOC4wNDY2IDM0LjgxOTUgOS41NCAzMy42NzI4IDEwLjc4QzMyLjUyNjEgMTIuMDIgMzEuMDk5NSAxMi42NCAyOS4zOTI4IDEyLjY0QzI3LjY4NjIgMTIuNjQgMjYuMjY2MSAxMi4wMjY3IDI1LjEzMjggMTAuOEMyMy45OTI4IDkuNTczMyAyMy40MjI4IDguMDg2NyAyMy40MjI4IDYuMzRDMjMuNDIyOCA0LjYgMjMuOTk5NSAzLjEwNjYgMjUuMTUyOCAxLjg2QzI2LjI5OTQuNjIgMjcuNzI2MSAwIDI5LjQzMjggMEMzMS4xMzk1IDAgMzIuNTU5NC42MTMzIDMzLjY5MjggMS44NE00OS44MjI4LjY3IDI5LjUzMjggMjguMzggMjQuNDEyOCAyOC4zOCA0NC43MTI4LjY3IDQ5LjgyMjguNjdNMzEuMDMyOCA4LjM4QzMxLjAzMjggOC4zOCAzMS4xMzk1IDguMjQ2NyAzMS4zNTI4IDcuOThDMzEuNTY2MiA3LjcwNjcgMzEuNjcyOCA3LjE3MzMgMzEuNjcyOCA2LjM4QzMxLjY3MjggNS41ODY3IDMxLjQ0NjEgNC45MiAzMC45OTI4IDQuMzhDMzAuNTQ2MSAzLjg0IDI5Ljk5OTUgMy41NyAyOS4zNTI4IDMuNTdDMjguNzA2MSAzLjU3IDI4LjE2OTUgMy44NCAyNy43NDI4IDQuMzhDMjcuMzIyOCA0LjkyIDI3LjExMjggNS41ODY3IDI3LjExMjggNi4zOEMyNy4xMTI4IDcuMTczMyAyNy4zMzYxIDcuODQgMjcuNzgyOCA4LjM4QzI4LjIzNjEgOC45MjY3IDI4Ljc4NjEgOS4yIDI5LjQzMjggOS4yQzMwLjA3OTUgOS4yIDMwLjYxMjggOC45MjY3IDMxLjAzMjggOC4zOE00OS40MzI4IDE3LjlDNDkuNDMyOCAxNy45IDQ5LjcxNjEgMTguMjA2NyA1MC4yODI4IDE4LjgyQzUwLjg0OTUgMTkuNDMzMyA1MS4xMzI4IDIwLjYxMzMgNTEuMTMyOCAyMi4zNkM1MS4xMzI4IDI0LjEgNTAuNTU5NCAyNS41OSA0OS40MTI4IDI2LjgzQzQ4LjI1OTUgMjguMDc2NiA0Ni44Mjk1IDI4LjcgNDUuMTIyOCAyOC43QzQzLjQyMjggMjguNyA0Mi4wMDI4IDI4LjA4MzMgNDAuODYyOCAyNi44NUMzOS43Mjk1IDI1LjYyMzMgMzkuMTYyOCAyNC4xMzY2IDM5LjE2MjggMjIuMzlDMzkuMTYyOCAyMC42NSAzOS43MzYxIDE5LjE2IDQwLjg4MjggMTcuOTJDNDIuMDM2MSAxNi42NzMzIDQzLjQ2MjggMTYuMDUgNDUuMTYyOCAxNi4wNUM0Ni44Njk0IDE2LjA1IDQ4LjI5MjggMTYuNjY2NyA0OS40MzI4IDE3LjlNNDYuODUyOCAyNC41MkM0Ni44NTI4IDI0LjUyIDQ2Ljk1OTUgMjQuMzgzMyA0Ny4xNzI4IDI0LjExQzQ3LjM3OTUgMjMuODM2NyA0Ny40ODI4IDIzLjMwMzMgNDcuNDgyOCAyMi41MUM0Ny40ODI4IDIxLjcxNjcgNDcuMjU5NSAyMS4wNSA0Ni44MTI4IDIwLjUxQzQ2LjM2NjEgMTkuOTcgNDUuODE2MiAxOS43IDQ1LjE2MjggMTkuN0M0NC41MTYxIDE5LjcgNDMuOTgyOCAxOS45NyA0My41NjI4IDIwLjUxQzQzLjE0MjggMjEuMDUgNDIuOTMyOCAyMS43MTY3IDQyLjkzMjggMjIuNTFDNDIuOTMyOCAyMy4zMDMzIDQzLjE1NjEgMjMuOTczMyA0My42MDI4IDI0LjUyQzQ0LjA0OTQgMjUuMDYgNDQuNTk2MSAyNS4zMyA0NS4yNDI4IDI1LjMzQzQ1Ljg4OTUgMjUuMzMgNDYuNDI2MSAyNS4wNiA0Ni44NTI4IDI0LjUyWlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+PC9zdmc+YDsiLCJpbXBvcnQgeyBJbnRlcm5hbE1vZHVsZSB9IGZyb20gXCIuLi9JbnRlcm5hbE1vZHVsZVwiO1xuXG5pbXBvcnQgeyBGaWxlU3lzdGVtQWRhcHRlciwgZ2V0QWxsVGFncywgTWFya2Rvd25WaWV3LCBub3JtYWxpemVQYXRoLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgVU5TVVBQT1JURURfTU9CSUxFX1RFTVBMQVRFIH0gZnJvbSBcIkNvbnN0YW50c1wiO1xuXG5leHBvcnQgY29uc3QgREVQVEhfTElNSVQgPSAxMDtcblxuZXhwb3J0IGNsYXNzIEludGVybmFsTW9kdWxlRmlsZSBleHRlbmRzIEludGVybmFsTW9kdWxlIHtcbiAgICBuYW1lID0gXCJmaWxlXCI7XG4gICAgcHJpdmF0ZSBpbmNsdWRlX2RlcHRoOiBudW1iZXIgPSAwO1xuXG4gICAgYXN5bmMgY3JlYXRlU3RhdGljVGVtcGxhdGVzKCkge1xuICAgICAgICAvLyBUT0RPOiBSZW1vdmUgdGhpc1xuICAgICAgICB0aGlzLnN0YXRpY190ZW1wbGF0ZXMuc2V0KFwiY2xpcGJvYXJkXCIsIHRoaXMuZ2VuZXJhdGVfY2xpcGJvYXJkKCkpO1xuICAgICAgICB0aGlzLnN0YXRpY190ZW1wbGF0ZXMuc2V0KFwiY3Vyc29yXCIsIHRoaXMuZ2VuZXJhdGVfY3Vyc29yKCkpO1xuICAgICAgICB0aGlzLnN0YXRpY190ZW1wbGF0ZXMuc2V0KFwic2VsZWN0aW9uXCIsIHRoaXMuZ2VuZXJhdGVfc2VsZWN0aW9uKCkpO1xuICAgIH1cblxuICAgIGFzeW5jIHVwZGF0ZVRlbXBsYXRlcygpIHtcbiAgICAgICAgdGhpcy5keW5hbWljX3RlbXBsYXRlcy5zZXQoXCJjb250ZW50XCIsIGF3YWl0IHRoaXMuZ2VuZXJhdGVfY29udGVudCgpKTtcbiAgICAgICAgdGhpcy5keW5hbWljX3RlbXBsYXRlcy5zZXQoXCJjcmVhdGlvbl9kYXRlXCIsIHRoaXMuZ2VuZXJhdGVfY3JlYXRpb25fZGF0ZSgpKTtcbiAgICAgICAgdGhpcy5keW5hbWljX3RlbXBsYXRlcy5zZXQoXCJmb2xkZXJcIiwgdGhpcy5nZW5lcmF0ZV9mb2xkZXIoKSk7XG4gICAgICAgIHRoaXMuZHluYW1pY190ZW1wbGF0ZXMuc2V0KFwiaW5jbHVkZVwiLCB0aGlzLmdlbmVyYXRlX2luY2x1ZGUoKSk7XG4gICAgICAgIHRoaXMuZHluYW1pY190ZW1wbGF0ZXMuc2V0KFwibGFzdF9tb2RpZmllZF9kYXRlXCIsIHRoaXMuZ2VuZXJhdGVfbGFzdF9tb2RpZmllZF9kYXRlKCkpO1xuICAgICAgICB0aGlzLmR5bmFtaWNfdGVtcGxhdGVzLnNldChcInBhdGhcIiwgdGhpcy5nZW5lcmF0ZV9wYXRoKCkpO1xuICAgICAgICB0aGlzLmR5bmFtaWNfdGVtcGxhdGVzLnNldChcInJlbmFtZVwiLCB0aGlzLmdlbmVyYXRlX3JlbmFtZSgpKTtcbiAgICAgICAgdGhpcy5keW5hbWljX3RlbXBsYXRlcy5zZXQoXCJ0YWdzXCIsIHRoaXMuZ2VuZXJhdGVfdGFncygpKTtcbiAgICAgICAgdGhpcy5keW5hbWljX3RlbXBsYXRlcy5zZXQoXCJ0aXRsZVwiLCB0aGlzLmdlbmVyYXRlX3RpdGxlKCkpO1xuXG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfY2xpcGJvYXJkKCkge1xuICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgLy8gVE9ETzogUmVtb3ZlIHRoaXNcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmxvZ191cGRhdGUoXCJ0cC5maWxlLmNsaXBib2FyZCB3YXMgbW92ZWQgdG8gYSBuZXcgbW9kdWxlOiBTeXN0ZW0gTW9kdWxlITxici8+IFlvdSBtdXN0IG5vdyB1c2UgdHAuc3lzdGVtLmNsaXBib2FyZCgpXCIpO1xuICAgICAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9jdXJzb3IoKSB7XG4gICAgICAgIHJldHVybiAob3JkZXI/OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIC8vIEhhY2sgdG8gcHJldmVudCBlbXB0eSBvdXRwdXRcbiAgICAgICAgICAgIHJldHVybiBgPCUgdHAuZmlsZS5jdXJzb3IoJHtvcmRlciA/PyAnJ30pICU+YDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdlbmVyYXRlX2NvbnRlbnQoKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHRoaXMuZmlsZSk7XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfY3JlYXRpb25fZGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIChmb3JtYXQ6IHN0cmluZyA9IFwiWVlZWS1NTS1ERCBISDptbVwiKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gd2luZG93Lm1vbWVudCh0aGlzLmZpbGUuc3RhdC5jdGltZSkuZm9ybWF0KGZvcm1hdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9mb2xkZXIoKSB7XG4gICAgICAgIHJldHVybiAocmVsYXRpdmU6IGJvb2xlYW4gPSBmYWxzZSkgPT4ge1xuICAgICAgICAgICAgbGV0IHBhcmVudCA9IHRoaXMuZmlsZS5wYXJlbnQ7XG4gICAgICAgICAgICBsZXQgZm9sZGVyO1xuXG4gICAgICAgICAgICBpZiAocmVsYXRpdmUpIHtcbiAgICAgICAgICAgICAgICBmb2xkZXIgPSBwYXJlbnQucGF0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvbGRlciA9IHBhcmVudC5uYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZm9sZGVyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfaW5jbHVkZSgpIHtcbiAgICAgICAgcmV0dXJuIGFzeW5jIChpbmNsdWRlX2ZpbGVuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGxldCBpbmNfZmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3Qobm9ybWFsaXplUGF0aChpbmNsdWRlX2ZpbGVuYW1lKSwgXCJcIik7XG4gICAgICAgICAgICBpZiAoIWluY19maWxlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGaWxlICR7aW5jbHVkZV9maWxlbmFtZX0gZG9lc24ndCBleGlzdGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEoaW5jX2ZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7aW5jbHVkZV9maWxlbmFtZX0gaXMgYSBmb2xkZXIsIG5vdCBhIGZpbGVgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVE9ETzogQWRkIG11dGV4IGZvciB0aGlzLCB0aGlzIG1heSBjdXJyZW50bHkgbGVhZCB0byBhIHJhY2UgY29uZGl0aW9uLiBcbiAgICAgICAgICAgIC8vIFdoaWxlIG5vdCB2ZXJ5IGltcGFjdGZ1bCwgdGhhdCBjb3VsZCBzdGlsbCBiZSBhbm5veWluZy5cbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZV9kZXB0aCArPSAxO1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZV9kZXB0aCA+IERFUFRIX0xJTUlUKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmNsdWRlX2RlcHRoID0gMDtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZWFjaGVkIGluY2x1c2lvbiBkZXB0aCBsaW1pdCAobWF4ID0gMTApXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgaW5jX2ZpbGVfY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoaW5jX2ZpbGUpO1xuICAgICAgICAgICAgbGV0IHBhcnNlZF9jb250ZW50ID0gYXdhaXQgdGhpcy5wbHVnaW4ucGFyc2VyLnBhcnNlVGVtcGxhdGVzKGluY19maWxlX2NvbnRlbnQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVfZGVwdGggLT0gMTtcbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VkX2NvbnRlbnQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9sYXN0X21vZGlmaWVkX2RhdGUoKSB7XG4gICAgICAgIHJldHVybiAoZm9ybWF0OiBzdHJpbmcgPSBcIllZWVktTU0tREQgSEg6bW1cIik6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICByZXR1cm4gd2luZG93Lm1vbWVudCh0aGlzLmZpbGUuc3RhdC5tdGltZSkuZm9ybWF0KGZvcm1hdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9wYXRoKCkge1xuICAgICAgICByZXR1cm4gKHJlbGF0aXZlOiBib29sZWFuID0gZmFsc2UpID0+IHtcbiAgICAgICAgICAgIC8vIFRPRE86IEFkZCBtb2JpbGUgc3VwcG9ydFxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwLmlzTW9iaWxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFVOU1VQUE9SVEVEX01PQklMRV9URU1QTEFURTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgaW5zdGFuY2VvZiBGaWxlU3lzdGVtQWRhcHRlcikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJhcHAudmF1bHQgaXMgbm90IGEgRmlsZVN5c3RlbUFkYXB0ZXIgaW5zdGFuY2VcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgdmF1bHRfcGF0aCA9IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZ2V0QmFzZVBhdGgoKTtcblxuICAgICAgICAgICAgaWYgKHJlbGF0aXZlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmlsZS5wYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGAke3ZhdWx0X3BhdGh9LyR7dGhpcy5maWxlLnBhdGh9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlX3JlbmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIGFzeW5jIChuZXdfdGl0bGU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgbGV0IG5ld19wYXRoID0gbm9ybWFsaXplUGF0aChgJHt0aGlzLmZpbGUucGFyZW50LnBhdGh9LyR7bmV3X3RpdGxlfS4ke3RoaXMuZmlsZS5leHRlbnNpb259YCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC5maWxlTWFuYWdlci5yZW5hbWVGaWxlKHRoaXMuZmlsZSwgbmV3X3BhdGgpO1xuICAgICAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9zZWxlY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICBsZXQgYWN0aXZlX3ZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuICAgICAgICAgICAgaWYgKGFjdGl2ZV92aWV3ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBY3RpdmUgdmlldyBpcyBudWxsLCBjYW4ndCByZWFkIHNlbGVjdGlvbi5cIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBlZGl0b3IgPSBhY3RpdmVfdmlldy5lZGl0b3I7XG4gICAgICAgICAgICByZXR1cm4gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfdGFncygpIHtcbiAgICAgICAgbGV0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUodGhpcy5maWxlKTtcbiAgICAgICAgcmV0dXJuIGdldEFsbFRhZ3MoY2FjaGUpO1xuICAgIH1cblxuICAgIGdlbmVyYXRlX3RpdGxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5maWxlLmJhc2VuYW1lO1xuICAgIH1cbn0iLCJpbXBvcnQgeyBJbnRlcm5hbE1vZHVsZSB9IGZyb20gXCIuLi9JbnRlcm5hbE1vZHVsZVwiO1xuXG5leHBvcnQgY2xhc3MgSW50ZXJuYWxNb2R1bGVXZWIgZXh0ZW5kcyBJbnRlcm5hbE1vZHVsZSB7XG4gICAgbmFtZSA9IFwid2ViXCI7XG5cbiAgICBhc3luYyBjcmVhdGVTdGF0aWNUZW1wbGF0ZXMoKSB7XG4gICAgICAgIHRoaXMuc3RhdGljX3RlbXBsYXRlcy5zZXQoXCJkYWlseV9xdW90ZVwiLCB0aGlzLmdlbmVyYXRlX2RhaWx5X3F1b3RlKCkpO1xuICAgICAgICB0aGlzLnN0YXRpY190ZW1wbGF0ZXMuc2V0KFwicmFuZG9tX3BpY3R1cmVcIiwgdGhpcy5nZW5lcmF0ZV9yYW5kb21fcGljdHVyZSgpKTtcbiAgICAgICAgdGhpcy5zdGF0aWNfdGVtcGxhdGVzLnNldChcImdldF9yZXF1ZXN0XCIsIHRoaXMuZ2VuZXJhdGVfZ2V0X3JlcXVlc3QoKSk7XG4gICAgfVxuICAgIFxuICAgIGFzeW5jIHVwZGF0ZVRlbXBsYXRlcygpIHt9XG5cbiAgICBhc3luYyBnZXRSZXF1ZXN0KHVybDogc3RyaW5nKTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICAgICAgICBsZXQgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwpO1xuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFcnJvciBwZXJmb3JtaW5nIEdFVCByZXF1ZXN0XCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXNwb25zZTtcbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9kYWlseV9xdW90ZSgpIHtcbiAgICAgICAgcmV0dXJuIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGxldCByZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0UmVxdWVzdChcImh0dHBzOi8vcXVvdGVzLnJlc3QvcW9kXCIpO1xuICAgICAgICAgICAgbGV0IGpzb24gPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cbiAgICAgICAgICAgIGxldCBhdXRob3IgPSBqc29uLmNvbnRlbnRzLnF1b3Rlc1swXS5hdXRob3I7XG4gICAgICAgICAgICBsZXQgcXVvdGUgPSBqc29uLmNvbnRlbnRzLnF1b3Rlc1swXS5xdW90ZTtcbiAgICAgICAgICAgIGxldCBuZXdfY29udGVudCA9IGA+ICR7cXVvdGV9XFxuPiAmbWRhc2g7IDxjaXRlPiR7YXV0aG9yfTwvY2l0ZT5gO1xuXG4gICAgICAgICAgICByZXR1cm4gbmV3X2NvbnRlbnQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9yYW5kb21fcGljdHVyZSgpIHtcbiAgICAgICAgcmV0dXJuIGFzeW5jIChzaXplOiBzdHJpbmcsIHF1ZXJ5Pzogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldFJlcXVlc3QoYGh0dHBzOi8vc291cmNlLnVuc3BsYXNoLmNvbS9yYW5kb20vJHtzaXplID8/ICcnfT8ke3F1ZXJ5ID8/ICcnfWApO1xuICAgICAgICAgICAgbGV0IHVybCA9IHJlc3BvbnNlLnVybDtcbiAgICAgICAgICAgIHJldHVybiBgIVt0cC53ZWIucmFuZG9tX3BpY3R1cmVdKCR7dXJsfSlgOyAgIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfZ2V0X3JlcXVlc3QoKSB7XG4gICAgICAgIHJldHVybiBhc3luYyAodXJsOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGxldCByZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0UmVxdWVzdCh1cmwpO1xuICAgICAgICAgICAgbGV0IGpzb24gPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgICAgICByZXR1cm4ganNvbjtcbiAgICAgICAgfVxuICAgIH1cbn0iLCJpbXBvcnQgeyBJbnRlcm5hbE1vZHVsZSB9IGZyb20gXCIuLi9JbnRlcm5hbE1vZHVsZVwiO1xuXG5leHBvcnQgY2xhc3MgSW50ZXJuYWxNb2R1bGVGcm9udG1hdHRlciBleHRlbmRzIEludGVybmFsTW9kdWxlIHtcbiAgICBuYW1lID0gXCJmcm9udG1hdHRlclwiO1xuXG4gICAgYXN5bmMgY3JlYXRlU3RhdGljVGVtcGxhdGVzKCkge31cblxuICAgIGFzeW5jIHVwZGF0ZVRlbXBsYXRlcygpIHtcbiAgICAgICAgbGV0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUodGhpcy5maWxlKVxuICAgICAgICB0aGlzLmR5bmFtaWNfdGVtcGxhdGVzID0gbmV3IE1hcChPYmplY3QuZW50cmllcyhjYWNoZT8uZnJvbnRtYXR0ZXIgfHwge30pKTtcbiAgICB9XG59IiwiaW1wb3J0IHsgQXBwLCBNb2RhbCB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5leHBvcnQgY2xhc3MgUHJvbXB0TW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gICAgcHJpdmF0ZSBwcm9tcHRFbDogSFRNTElucHV0RWxlbWVudDtcbiAgICBwcml2YXRlIGNiOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZDtcblxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHByb21wdF90ZXh0OiBzdHJpbmcsIHByaXZhdGUgZGVmYXVsdF92YWx1ZTogc3RyaW5nKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG4gICAgfVxuXG4gICAgb25PcGVuKCkge1xuICAgICAgICB0aGlzLnRpdGxlRWwuc2V0VGV4dCh0aGlzLnByb21wdF90ZXh0KTtcbiAgICAgICAgdGhpcy5jcmVhdGVGb3JtKCk7XG4gICAgfVxuXG4gICAgb25DbG9zZSgpIHtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgICB9XG5cbiAgICBjcmVhdGVGb3JtKCkge1xuICAgICAgICBsZXQgZGl2ID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgICAgIGRpdi5hZGRDbGFzcyhcInRlbXBsYXRlci1wcm9tcHQtZGl2XCIpO1xuXG4gICAgICAgIGxldCBmb3JtID0gZGl2LmNyZWF0ZUVsKFwiZm9ybVwiKTtcbiAgICAgICAgZm9ybS5hZGRDbGFzcyhcInRlbXBsYXRlci1wcm9tcHQtZm9ybVwiKTtcbiAgICAgICAgZm9ybS50eXBlID0gXCJzdWJtaXRcIjtcbiAgICAgICAgZm9ybS5vbnN1Ym1pdCA9IChlOiBFdmVudCkgPT4ge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5jYih0aGlzLnByb21wdEVsLnZhbHVlKTtcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucHJvbXB0RWwgPSBmb3JtLmNyZWF0ZUVsKFwiaW5wdXRcIik7XG4gICAgICAgIHRoaXMucHJvbXB0RWwudHlwZSA9IFwidGV4dFwiO1xuICAgICAgICB0aGlzLnByb21wdEVsLnBsYWNlaG9sZGVyID0gXCJUeXBlIHRleHQgaGVyZS4uLlwiO1xuICAgICAgICB0aGlzLnByb21wdEVsLnZhbHVlID0gdGhpcy5kZWZhdWx0X3ZhbHVlID8/IFwiXCI7XG4gICAgICAgIHRoaXMucHJvbXB0RWwuYWRkQ2xhc3MoXCJ0ZW1wbGF0ZXItcHJvbXB0LWlucHV0XCIpXG4gICAgICAgIHRoaXMucHJvbXB0RWwuc2VsZWN0KCk7XG4gICAgfVxuXG4gICAgYXN5bmMgb3BlbkFuZEdldFZhbHVlKGNiOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZCkge1xuICAgICAgICB0aGlzLmNiID0gY2I7XG4gICAgICAgIHRoaXMub3BlbigpO1xuICAgIH1cbn0iLCJpbXBvcnQgeyBVTlNVUFBPUlRFRF9NT0JJTEVfVEVNUExBVEUgfSBmcm9tIFwiQ29uc3RhbnRzXCI7XG5pbXBvcnQgeyBJbnRlcm5hbE1vZHVsZSB9IGZyb20gXCJJbnRlcm5hbFRlbXBsYXRlcy9JbnRlcm5hbE1vZHVsZVwiO1xuaW1wb3J0IHsgUHJvbXB0TW9kYWwgfSBmcm9tIFwiLi9Qcm9tcHRNb2RhbFwiO1xuXG5leHBvcnQgY2xhc3MgSW50ZXJuYWxNb2R1bGVTeXN0ZW0gZXh0ZW5kcyBJbnRlcm5hbE1vZHVsZSB7XG4gICAgbmFtZSA9IFwic3lzdGVtXCI7XG5cbiAgICBhc3luYyBjcmVhdGVTdGF0aWNUZW1wbGF0ZXMoKSB7XG4gICAgICAgIHRoaXMuc3RhdGljX3RlbXBsYXRlcy5zZXQoXCJjbGlwYm9hcmRcIiwgdGhpcy5nZW5lcmF0ZV9jbGlwYm9hcmQoKSk7XG4gICAgICAgIHRoaXMuc3RhdGljX3RlbXBsYXRlcy5zZXQoXCJwcm9tcHRcIiwgdGhpcy5nZW5lcmF0ZV9wcm9tcHQoKSk7XG4gICAgfVxuXG4gICAgYXN5bmMgdXBkYXRlVGVtcGxhdGVzKCkge31cblxuICAgIGdlbmVyYXRlX2NsaXBib2FyZCgpIHtcbiAgICAgICAgcmV0dXJuIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIC8vIFRPRE86IEFkZCBtb2JpbGUgc3VwcG9ydFxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwLmlzTW9iaWxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFVOU1VQUE9SVEVEX01PQklMRV9URU1QTEFURTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLnJlYWRUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9wcm9tcHQoKSB7XG4gICAgICAgIHJldHVybiAocHJvbXB0X3RleHQ/OiBzdHJpbmcsIGRlZmF1bHRfdmFsdWU/OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICAgICAgICAgICAgbGV0IHByb21wdCA9IG5ldyBQcm9tcHRNb2RhbCh0aGlzLmFwcCwgcHJvbXB0X3RleHQsIGRlZmF1bHRfdmFsdWUpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZCkgPT4gcHJvbXB0Lm9wZW5BbmRHZXRWYWx1ZShyZXNvbHZlKSk7XG4gICAgICAgIH1cbiAgICB9XG59IiwiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgVGVtcGxhdGVyUGx1Z2luIGZyb20gXCJtYWluXCI7XG5pbXBvcnQgeyBUUGFyc2VyIH0gZnJvbSBcIlRQYXJzZXJcIjtcbmltcG9ydCB7IEludGVybmFsTW9kdWxlIH0gZnJvbSBcIi4vSW50ZXJuYWxNb2R1bGVcIjtcbmltcG9ydCB7IEludGVybmFsTW9kdWxlRGF0ZSB9IGZyb20gXCIuL2RhdGUvSW50ZXJuYWxNb2R1bGVEYXRlXCI7XG5pbXBvcnQgeyBJbnRlcm5hbE1vZHVsZUZpbGUgfSBmcm9tIFwiLi9maWxlL0ludGVybmFsTW9kdWxlRmlsZVwiO1xuaW1wb3J0IHsgSW50ZXJuYWxNb2R1bGVXZWIgfSBmcm9tIFwiLi93ZWIvSW50ZXJuYWxNb2R1bGVXZWJcIjtcbmltcG9ydCB7IEludGVybmFsTW9kdWxlRnJvbnRtYXR0ZXIgfSBmcm9tIFwiLi9mcm9udG1hdHRlci9JbnRlcm5hbE1vZHVsZUZyb250bWF0dGVyXCI7XG5pbXBvcnQgeyBJbnRlcm5hbE1vZHVsZVN5c3RlbSB9IGZyb20gXCIuL3N5c3RlbS9JbnRlcm5hbE1vZHVsZVN5c3RlbVwiO1xuXG5leHBvcnQgY2xhc3MgSW50ZXJuYWxUZW1wbGF0ZVBhcnNlciBleHRlbmRzIFRQYXJzZXIge1xuICAgIHByaXZhdGUgbW9kdWxlc19hcnJheTogQXJyYXk8SW50ZXJuYWxNb2R1bGU+ID0gbmV3IEFycmF5KCk7XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IFRlbXBsYXRlclBsdWdpbikge1xuICAgICAgICBzdXBlcihhcHApO1xuICAgICAgICB0aGlzLmNyZWF0ZU1vZHVsZXMoKTtcbiAgICB9XG5cbiAgICBjcmVhdGVNb2R1bGVzKCkge1xuICAgICAgICB0aGlzLm1vZHVsZXNfYXJyYXkucHVzaChuZXcgSW50ZXJuYWxNb2R1bGVEYXRlKHRoaXMuYXBwLCB0aGlzLnBsdWdpbikpO1xuICAgICAgICB0aGlzLm1vZHVsZXNfYXJyYXkucHVzaChuZXcgSW50ZXJuYWxNb2R1bGVGaWxlKHRoaXMuYXBwLCB0aGlzLnBsdWdpbikpO1xuICAgICAgICB0aGlzLm1vZHVsZXNfYXJyYXkucHVzaChuZXcgSW50ZXJuYWxNb2R1bGVXZWIodGhpcy5hcHAsIHRoaXMucGx1Z2luKSk7XG4gICAgICAgIHRoaXMubW9kdWxlc19hcnJheS5wdXNoKG5ldyBJbnRlcm5hbE1vZHVsZUZyb250bWF0dGVyKHRoaXMuYXBwLCB0aGlzLnBsdWdpbikpO1xuICAgICAgICB0aGlzLm1vZHVsZXNfYXJyYXkucHVzaChuZXcgSW50ZXJuYWxNb2R1bGVTeXN0ZW0odGhpcy5hcHAsIHRoaXMucGx1Z2luKSk7XG4gICAgfVxuXG4gICAgYXN5bmMgZ2VuZXJhdGVDb250ZXh0KGY6IFRGaWxlKSB7XG4gICAgICAgIGxldCBtb2R1bGVzX2NvbnRleHRfbWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIGZvciAobGV0IG1vZCBvZiB0aGlzLm1vZHVsZXNfYXJyYXkpIHtcbiAgICAgICAgICAgIG1vZHVsZXNfY29udGV4dF9tYXAuc2V0KG1vZC5nZXROYW1lKCksIGF3YWl0IG1vZC5nZW5lcmF0ZUNvbnRleHQoZikpO1xuICAgICAgICB9XG5cbiAgICAgICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKG1vZHVsZXNfY29udGV4dF9tYXApO1xuICAgIH1cbn0iLCJpbXBvcnQgeyBBcHAsIEZpbGVTeXN0ZW1BZGFwdGVyLCBOb3RpY2UsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gXCJ1dGlsXCI7XG5cbmltcG9ydCBUZW1wbGF0ZXJQbHVnaW4gZnJvbSBcIm1haW5cIjtcbmltcG9ydCB7IENvbnRleHRNb2RlIH0gZnJvbSBcIlRlbXBsYXRlUGFyc2VyXCI7XG5pbXBvcnQgeyBUUGFyc2VyIH0gZnJvbSBcIlRQYXJzZXJcIjtcblxuZXhwb3J0IGNsYXNzIFVzZXJUZW1wbGF0ZVBhcnNlciBleHRlbmRzIFRQYXJzZXIge1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIGNtZF9vcHRpb25zOiBhbnk7XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IFRlbXBsYXRlclBsdWdpbikge1xuICAgICAgICBzdXBlcihhcHApO1xuICAgICAgICB0aGlzLnJlc29sdmVDd2QoKTsgICAgICAgIFxuICAgIH1cblxuICAgIHJlc29sdmVDd2QoKSB7XG4gICAgICAgIC8vIFRPRE86IEFkZCBtb2JpbGUgc3VwcG9ydFxuICAgICAgICBpZiAodGhpcy5hcHAuaXNNb2JpbGUgfHwgISh0aGlzLmFwcC52YXVsdC5hZGFwdGVyIGluc3RhbmNlb2YgRmlsZVN5c3RlbUFkYXB0ZXIpKSB7XG4gICAgICAgICAgICB0aGlzLmN3ZCA9IFwiXCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmN3ZCA9IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZ2V0QmFzZVBhdGgoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdlbmVyYXRlVXNlclRlbXBsYXRlcyhmaWxlOiBURmlsZSkge1xuICAgICAgICBsZXQgdXNlcl90ZW1wbGF0ZXMgPSBuZXcgTWFwKCk7XG4gICAgICAgIGNvbnN0IGV4ZWNfcHJvbWlzZSA9IHByb21pc2lmeShleGVjKTtcblxuICAgICAgICBsZXQgY29udGV4dCA9IGF3YWl0IHRoaXMucGx1Z2luLnBhcnNlci5nZW5lcmF0ZUNvbnRleHQoZmlsZSwgQ29udGV4dE1vZGUuSU5URVJOQUwpO1xuXG4gICAgICAgIGZvciAobGV0IFt0ZW1wbGF0ZSwgY21kXSBvZiB0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZXNfcGFpcnMpIHtcbiAgICAgICAgICAgIGlmICh0ZW1wbGF0ZSA9PT0gXCJcIiB8fCBjbWQgPT09IFwiXCIpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY21kID0gYXdhaXQgdGhpcy5wbHVnaW4ucGFyc2VyLnBhcnNlVGVtcGxhdGVzKGNtZCwgY29udGV4dCk7XG5cbiAgICAgICAgICAgIHVzZXJfdGVtcGxhdGVzLnNldCh0ZW1wbGF0ZSwgYXN5bmMgKHVzZXJfYXJncz86IGFueSk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHByb2Nlc3NfZW52ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4ucHJvY2Vzcy5lbnYsXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi51c2VyX2FyZ3MsXG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGNtZF9vcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29tbWFuZF90aW1lb3V0ICogMTAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGN3ZDogdGhpcy5jd2QsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnY6IHByb2Nlc3NfZW52LFxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCB7c3Rkb3V0fSA9IGF3YWl0IGV4ZWNfcHJvbWlzZShjbWQsIGNtZF9vcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN0ZG91dC50cmltUmlnaHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ubG9nX2Vycm9yKGBFcnJvciB3aXRoIFVzZXIgVGVtcGxhdGUgJHt0ZW1wbGF0ZX1gLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdXNlcl90ZW1wbGF0ZXM7XG4gICAgfVxuXG4gICAgYXN5bmMgZ2VuZXJhdGVDb250ZXh0KGZpbGU6IFRGaWxlKSB7XG4gICAgICAgIGxldCB1c2VyX3RlbXBsYXRlcyA9IGF3YWl0IHRoaXMuZ2VuZXJhdGVVc2VyVGVtcGxhdGVzKGZpbGUpO1xuICAgICAgICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKHVzZXJfdGVtcGxhdGVzKTtcbiAgICB9XG59IiwiaW1wb3J0IHsgQXBwLCBFZGl0b3JQb3NpdGlvbiwgRWRpdG9yUmFuZ2VPckNhcmV0LCBFZGl0b3JUcmFuc2FjdGlvbiwgTWFya2Rvd25WaWV3IH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBlc2NhcGVSZWdFeHAgfSBmcm9tIFwiVXRpbHNcIjtcblxuZXhwb3J0IGNsYXNzIEN1cnNvckp1bXBlciB7XG4gICAgcHJpdmF0ZSBjdXJzb3JfcmVnZXggPSBuZXcgUmVnRXhwKFwiPCVcXFxccyp0cC5maWxlLmN1cnNvclxcXFwoKD88b3JkZXI+WzAtOV17MCwyfSlcXFxcKVxcXFxzKiU+XCIsIFwiZ1wiKTtcdFxuXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBhcHA6IEFwcCkge31cblxuICAgIGdldF9lZGl0b3JfcG9zaXRpb25fZnJvbV9pbmRleChjb250ZW50OiBzdHJpbmcsIGluZGV4OiBudW1iZXIpOiBFZGl0b3JQb3NpdGlvbiB7XG4gICAgICAgIGxldCBzdWJzdHIgPSBjb250ZW50LnN1YnN0cigwLCBpbmRleCk7XG5cbiAgICAgICAgbGV0IGwgPSAwO1xuICAgICAgICBsZXQgb2Zmc2V0ID0gLTE7XG4gICAgICAgIGxldCByID0gLTE7XG4gICAgICAgIGZvciAoOyAociA9IHN1YnN0ci5pbmRleE9mKFwiXFxuXCIsIHIrMSkpICE9PSAtMSA7IGwrKywgb2Zmc2V0PXIpO1xuICAgICAgICBvZmZzZXQgKz0gMTtcblxuICAgICAgICBsZXQgY2ggPSBjb250ZW50LnN1YnN0cihvZmZzZXQsIGluZGV4LW9mZnNldCkubGVuZ3RoO1xuXG4gICAgICAgIHJldHVybiB7bGluZTogbCwgY2g6IGNofTtcbiAgICB9XG5cbiAgICBhc3luYyBqdW1wX3RvX25leHRfY3Vyc29yX2xvY2F0aW9uKCkge1xuICAgICAgICBsZXQgYWN0aXZlX3ZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuICAgICAgICBpZiAoYWN0aXZlX3ZpZXcgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIGFjdGl2ZSB2aWV3LCBjYW4ndCBhcHBlbmQgdGVtcGxhdGVzLlwiKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgYWN0aXZlX2ZpbGUgPSBhY3RpdmVfdmlldy5maWxlO1xuICAgICAgICBhd2FpdCBhY3RpdmVfdmlldy5zYXZlKCk7XG5cbiAgICAgICAgbGV0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGFjdGl2ZV9maWxlKTtcblxuICAgICAgICBjb25zdCB7bmV3X2NvbnRlbnQsIHBvc2l0aW9uc30gPSB0aGlzLnJlcGxhY2VfYW5kX2dldF9jdXJzb3JfcG9zaXRpb25zKGNvbnRlbnQpO1xuICAgICAgICBpZiAocG9zaXRpb25zKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoYWN0aXZlX2ZpbGUsIG5ld19jb250ZW50KTtcbiAgICAgICAgICAgIHRoaXMuc2V0X2N1cnNvcl9sb2NhdGlvbihwb3NpdGlvbnMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVwbGFjZV9hbmRfZ2V0X2N1cnNvcl9wb3NpdGlvbnMoY29udGVudDogc3RyaW5nKSB7XG4gICAgICAgIGxldCBjdXJzb3JfbWF0Y2hlcyA9IFtdO1xuICAgICAgICBsZXQgbWF0Y2g7XG4gICAgICAgIHdoaWxlKChtYXRjaCA9IHRoaXMuY3Vyc29yX3JlZ2V4LmV4ZWMoY29udGVudCkpICE9IG51bGwpIHtcbiAgICAgICAgICAgIGN1cnNvcl9tYXRjaGVzLnB1c2gobWF0Y2gpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdXJzb3JfbWF0Y2hlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGN1cnNvcl9tYXRjaGVzLnNvcnQoKG0xLCBtMikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIE51bWJlcihtMS5ncm91cHNbXCJvcmRlclwiXSkgLSBOdW1iZXIobTIuZ3JvdXBzW1wib3JkZXJcIl0pO1xuICAgICAgICB9KTtcbiAgICAgICAgbGV0IG1hdGNoX3N0ciA9IGN1cnNvcl9tYXRjaGVzWzBdWzBdO1xuXG4gICAgICAgIGN1cnNvcl9tYXRjaGVzID0gY3Vyc29yX21hdGNoZXMuZmlsdGVyKG0gPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG1bMF0gPT09IG1hdGNoX3N0cjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IHBvc2l0aW9ucyA9IFtdO1xuICAgICAgICBsZXQgaW5kZXhfb2Zmc2V0ID0gMDtcbiAgICAgICAgZm9yIChsZXQgbWF0Y2ggb2YgY3Vyc29yX21hdGNoZXMpIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IG1hdGNoLmluZGV4IC0gaW5kZXhfb2Zmc2V0O1xuICAgICAgICAgICAgcG9zaXRpb25zLnB1c2godGhpcy5nZXRfZWRpdG9yX3Bvc2l0aW9uX2Zyb21faW5kZXgoY29udGVudCwgaW5kZXgpKTtcblxuICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZShuZXcgUmVnRXhwKGVzY2FwZVJlZ0V4cChtYXRjaFswXSkpLCBcIlwiKTtcbiAgICAgICAgICAgIGluZGV4X29mZnNldCArPSBtYXRjaFswXS5sZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIFRPRE86IFJlbW92ZSB0aGlzLCBicmVha2luZyBmb3Igbm93IHdhaXRpbmcgZm9yIHRoZSBuZXcgc2V0U2VsZWN0aW9ucyBBUElcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgLy8gRm9yIHRwLmZpbGUuY3Vyc29yKCksIHdlIG9ubHkgZmluZCBvbmVcbiAgICAgICAgICAgIGlmIChtYXRjaFsxXSA9PT0gXCJcIikge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKi9cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7bmV3X2NvbnRlbnQ6IGNvbnRlbnQsIHBvc2l0aW9uczogcG9zaXRpb25zfTtcbiAgICB9XG5cbiAgICBzZXRfY3Vyc29yX2xvY2F0aW9uKHBvc2l0aW9uczogQXJyYXk8RWRpdG9yUG9zaXRpb24+KSB7XG4gICAgICAgIGxldCBhY3RpdmVfdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgICAgIGlmIChhY3RpdmVfdmlldyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETzogUmVtb3ZlIHRoaXNcbiAgICAgICAgbGV0IGVkaXRvciA9IGFjdGl2ZV92aWV3LmVkaXRvcjtcbiAgICAgICAgZWRpdG9yLmZvY3VzKCk7XG4gICAgICAgIGVkaXRvci5zZXRDdXJzb3IocG9zaXRpb25zWzBdKTtcblxuICAgICAgICAvKlxuICAgICAgICBsZXQgc2VsZWN0aW9ucyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBwb3Mgb2YgcG9zaXRpb25zKSB7XG4gICAgICAgICAgICBzZWxlY3Rpb25zLnB1c2goe2FuY2hvcjogcG9zLCBoZWFkOiBwb3N9KTtcbiAgICAgICAgfVxuICAgICAgICBlZGl0b3IuZm9jdXMoKTtcbiAgICAgICAgZWRpdG9yLnNldFNlbGVjdGlvbnMoc2VsZWN0aW9ucyk7XG4gICAgICAgICovXG5cbiAgICAgICAgLypcbiAgICAgICAgLy8gQ2hlY2sgaHR0cHM6Ly9naXRodWIuY29tL29ic2lkaWFubWQvb2JzaWRpYW4tYXBpL2lzc3Vlcy8xNFxuXG4gICAgICAgIGxldCBlZGl0b3IgPSBhY3RpdmVfdmlldy5lZGl0b3I7XG4gICAgICAgIGVkaXRvci5mb2N1cygpO1xuXG4gICAgICAgIGZvciAobGV0IHBvcyBvZiBwb3NpdGlvbnMpIHtcbiAgICAgICAgICAgIGxldCB0cmFuc2FjdGlvbjogRWRpdG9yVHJhbnNhY3Rpb24gPSB7XG4gICAgICAgICAgICAgICAgc2VsZWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgIGZyb206IHBvc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBlZGl0b3IudHJhbnNhY3Rpb24odHJhbnNhY3Rpb24pO1xuICAgICAgICB9XG4gICAgICAgICovXG4gICAgfVxufSIsImltcG9ydCB7IEFwcCwgRWRpdG9yUG9zaXRpb24sIE1hcmtkb3duVmlldywgVEZpbGUsIFRGb2xkZXIgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCAqIGFzIEV0YSBmcm9tIFwiZXRhXCI7XG5cbmltcG9ydCB7IEludGVybmFsVGVtcGxhdGVQYXJzZXIgfSBmcm9tIFwiLi9JbnRlcm5hbFRlbXBsYXRlcy9JbnRlcm5hbFRlbXBsYXRlUGFyc2VyXCI7XG5pbXBvcnQgVGVtcGxhdGVyUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB7IFVzZXJUZW1wbGF0ZVBhcnNlciB9IGZyb20gXCIuL1VzZXJUZW1wbGF0ZXMvVXNlclRlbXBsYXRlUGFyc2VyXCI7XG5pbXBvcnQgeyBUUGFyc2VyIH0gZnJvbSBcIlRQYXJzZXJcIjtcbmltcG9ydCB7IEN1cnNvckp1bXBlciB9IGZyb20gXCJDdXJzb3JKdW1wZXJcIjtcblxuZXhwb3J0IGVudW0gQ29udGV4dE1vZGUge1xuICAgIFVTRVIsXG4gICAgSU5URVJOQUwsXG4gICAgVVNFUl9JTlRFUk5BTCxcbiAgICBEWU5BTUlDLFxufTtcblxuLy8gVE9ETzogUmVtb3ZlIHRoYXRcbmNvbnN0IHRwX2N1cnNvciA9IG5ldyBSZWdFeHAoXCI8JVxcXFxzKnRwLmZpbGUuY3Vyc29yXFxcXHMqJT5cIik7XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZVBhcnNlciBleHRlbmRzIFRQYXJzZXIge1xuICAgIHB1YmxpYyBpbnRlcm5hbFRlbXBsYXRlUGFyc2VyOiBJbnRlcm5hbFRlbXBsYXRlUGFyc2VyO1xuXHRwdWJsaWMgdXNlclRlbXBsYXRlUGFyc2VyOiBVc2VyVGVtcGxhdGVQYXJzZXIgPSBudWxsO1xuICAgIHByaXZhdGUgY3VycmVudF9jb250ZXh0OiBhbnk7XG4gICAgcHVibGljIGN1cnNvcl9qdW1wZXI6IEN1cnNvckp1bXBlcjtcbiAgICBcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IFRlbXBsYXRlclBsdWdpbikge1xuICAgICAgICBzdXBlcihhcHApO1xuICAgICAgICB0aGlzLmN1cnNvcl9qdW1wZXIgPSBuZXcgQ3Vyc29ySnVtcGVyKHRoaXMuYXBwKTtcbiAgICAgICAgdGhpcy5pbnRlcm5hbFRlbXBsYXRlUGFyc2VyID0gbmV3IEludGVybmFsVGVtcGxhdGVQYXJzZXIodGhpcy5hcHAsIHRoaXMucGx1Z2luKTtcbiAgICAgICAgLy8gVE9ETzogQWRkIG1vYmlsZSBzdXBwb3J0XG4gICAgICAgIGlmICghdGhpcy5hcHAuaXNNb2JpbGUpIHtcbiAgICAgICAgICAgIHRoaXMudXNlclRlbXBsYXRlUGFyc2VyID0gbmV3IFVzZXJUZW1wbGF0ZVBhcnNlcih0aGlzLmFwcCwgdGhpcy5wbHVnaW4pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2V0Q3VycmVudENvbnRleHQoZmlsZTogVEZpbGUsIGNvbnRleHRfbW9kZTogQ29udGV4dE1vZGUpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50X2NvbnRleHQgPSBhd2FpdCB0aGlzLmdlbmVyYXRlQ29udGV4dChmaWxlLCBjb250ZXh0X21vZGUpO1xuICAgIH1cblxuICAgIGFzeW5jIGdlbmVyYXRlQ29udGV4dChmaWxlOiBURmlsZSwgY29udGV4dF9tb2RlOiBDb250ZXh0TW9kZSA9IENvbnRleHRNb2RlLlVTRVJfSU5URVJOQUwpIHtcbiAgICAgICAgbGV0IGNvbnRleHQgPSB7fTtcbiAgICAgICAgbGV0IGludGVybmFsX2NvbnRleHQgPSBhd2FpdCB0aGlzLmludGVybmFsVGVtcGxhdGVQYXJzZXIuZ2VuZXJhdGVDb250ZXh0KGZpbGUpO1xuICAgICAgICBsZXQgdXNlcl9jb250ZXh0ID0ge307XG5cbiAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRfY29udGV4dCkge1xuICAgICAgICAgICAgLy8gSWYgYSB1c2VyIHN5c3RlbSBjb21tYW5kIGlzIHVzaW5nIHRwLmZpbGUuaW5jbHVkZSwgd2UgbmVlZCB0aGUgY29udGV4dCB0byBiZSBzZXQuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRfY29udGV4dCA9IGludGVybmFsX2NvbnRleHQ7XG4gICAgICAgIH1cblxuICAgICAgICBzd2l0Y2ggKGNvbnRleHRfbW9kZSkge1xuICAgICAgICAgICAgY2FzZSBDb250ZXh0TW9kZS5VU0VSOlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnVzZXJUZW1wbGF0ZVBhcnNlcikge1xuICAgICAgICAgICAgICAgICAgICB1c2VyX2NvbnRleHQgPSBhd2FpdCB0aGlzLnVzZXJUZW1wbGF0ZVBhcnNlci5nZW5lcmF0ZUNvbnRleHQoZmlsZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRleHQgPSB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXI6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnVzZXJfY29udGV4dFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQ29udGV4dE1vZGUuSU5URVJOQUw6XG4gICAgICAgICAgICAgICAgY29udGV4dCA9IGludGVybmFsX2NvbnRleHQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIENvbnRleHRNb2RlLkRZTkFNSUM6XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudXNlclRlbXBsYXRlUGFyc2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXJfY29udGV4dCA9IGF3YWl0IHRoaXMudXNlclRlbXBsYXRlUGFyc2VyLmdlbmVyYXRlQ29udGV4dChmaWxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29udGV4dCA9IHtcbiAgICAgICAgICAgICAgICAgICAgZHluYW1pYzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4uaW50ZXJuYWxfY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZXI6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi51c2VyX2NvbnRleHRcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIENvbnRleHRNb2RlLlVTRVJfSU5URVJOQUw6XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudXNlclRlbXBsYXRlUGFyc2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXJfY29udGV4dCA9IGF3YWl0IHRoaXMudXNlclRlbXBsYXRlUGFyc2VyLmdlbmVyYXRlQ29udGV4dChmaWxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29udGV4dCA9IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uaW50ZXJuYWxfY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgdXNlcjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4udXNlcl9jb250ZXh0XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgfVxuXG4gICAgYXN5bmMgcGFyc2VUZW1wbGF0ZXMoY29udGVudDogc3RyaW5nLCBjb250ZXh0PzogYW55KSB7XG4gICAgICAgIGlmICghY29udGV4dCkge1xuICAgICAgICAgICAgY29udGV4dCA9IHRoaXMuY3VycmVudF9jb250ZXh0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbnRlbnQubWF0Y2godHBfY3Vyc29yKSkge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubG9nX3VwZGF0ZShgdHAuZmlsZS5jdXJzb3Igd2FzIHVwZGF0ZWQhIEl0J3Mgbm93IGFuIGludGVybmFsIGZ1bmN0aW9uLCB5b3Ugc2hvdWxkIGNhbGwgaXQgbGlrZSBzbzogdHAuZmlsZS5jdXJzb3IoKSA8YnIvPlxudHAuZmlsZS5jdXJzb3Igbm93IHN1cHBvcnRzIGN1cnNvciBqdW1wIG9yZGVyISBTcGVjaWZ5IHRoZSBqdW1wIG9yZGVyIGFzIGFuIGFyZ3VtZW50ICh0cC5maWxlLmN1cnNvcigxKSwgdHAuZmlsZS5jdXJzb3IoMiksIC4uLiksIGlmIHlvdSB3aXNoIHRvIGNoYW5nZSB0aGUgZGVmYXVsdCB0b3AgdG8gYm90dG9tIG9yZGVyLjxici8+XG5DaGVjayB0aGUgPGEgaHJlZj0naHR0cHM6Ly9zaWxlbnR2b2lkMTMuZ2l0aHViLmlvL1RlbXBsYXRlci9kb2NzL2ludGVybmFsLXZhcmlhYmxlcy1mdW5jdGlvbnMvaW50ZXJuYWwtbW9kdWxlcy9maWxlLW1vZHVsZSc+ZG9jdW1lbnRhdGlvbjwvYT4gZm9yIG1vcmUgaW5mb3JtYXRpb25zLmApO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb250ZW50ID0gYXdhaXQgRXRhLnJlbmRlckFzeW5jKGNvbnRlbnQsIGNvbnRleHQsIHtcbiAgICAgICAgICAgICAgICB2YXJOYW1lOiBcInRwXCIsXG4gICAgICAgICAgICAgICAgcGFyc2U6IHtcbiAgICAgICAgICAgICAgICAgICAgZXhlYzogXCIqXCIsXG4gICAgICAgICAgICAgICAgICAgIGludGVycG9sYXRlOiBcIn5cIixcbiAgICAgICAgICAgICAgICAgICAgcmF3OiBcIlwiLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYXV0b1RyaW06IGZhbHNlLFxuICAgICAgICAgICAgICAgIGdsb2JhbEF3YWl0OiB0cnVlLFxuICAgICAgICAgICAgfSkgYXMgc3RyaW5nO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sb2dfZXJyb3IoXCJUZW1wbGF0ZSBwYXJzaW5nIGVycm9yLCBhYm9ydGluZy5cIiwgZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgfVxuXG4gICAgcmVwbGFjZV9pbl9hY3RpdmVfZmlsZSgpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0bGV0IGFjdGl2ZV92aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcblx0XHRcdGlmIChhY3RpdmVfdmlldyA9PT0gbnVsbCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBY3RpdmUgdmlldyBpcyBudWxsXCIpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5yZXBsYWNlX3RlbXBsYXRlc19hbmRfb3ZlcndyaXRlX2luX2ZpbGUoYWN0aXZlX3ZpZXcuZmlsZSk7XG5cdFx0fVxuXHRcdGNhdGNoKGVycm9yKSB7XG5cdFx0XHR0aGlzLnBsdWdpbi5sb2dfZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG4gICAgYXN5bmMgY3JlYXRlX25ld19ub3RlX2Zyb21fdGVtcGxhdGUodGVtcGxhdGVfZmlsZTogVEZpbGUsIGZvbGRlcj86IFRGb2xkZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCB0ZW1wbGF0ZV9jb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZCh0ZW1wbGF0ZV9maWxlKTtcblxuICAgICAgICAgICAgaWYgKCFmb2xkZXIpIHtcbiAgICAgICAgICAgICAgICBmb2xkZXIgPSB0aGlzLmFwcC5maWxlTWFuYWdlci5nZXROZXdGaWxlUGFyZW50KFwiXCIpO1xuICAgICAgICAgICAgICAgIC8vZm9sZGVyID0gdGhpcy5hcHAudmF1bHQuZ2V0Q29uZmlnKFwibmV3RmlsZUZvbGRlclBhdGhcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRPRE86IENoYW5nZSB0aGF0LCBub3Qgc3RhYmxlIGF0bVxuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgbGV0IGNyZWF0ZWRfbm90ZSA9IGF3YWl0IHRoaXMuYXBwLmZpbGVNYW5hZ2VyLmNyZWF0ZU5ld01hcmtkb3duRmlsZShmb2xkZXIsIFwiVW50aXRsZWRcIik7XG4gICAgICAgICAgICAvL2xldCBjcmVhdGVkX25vdGUgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUoXCJVbnRpdGxlZC5tZFwiLCBcIlwiKTtcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXRDdXJyZW50Q29udGV4dChjcmVhdGVkX25vdGUsIENvbnRleHRNb2RlLlVTRVJfSU5URVJOQUwpO1xuICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnBsdWdpbi5wYXJzZXIucGFyc2VUZW1wbGF0ZXModGVtcGxhdGVfY29udGVudCk7XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShjcmVhdGVkX25vdGUsIGNvbnRlbnQpO1xuXG4gICAgICAgICAgICBsZXQgYWN0aXZlX2xlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZjtcbiAgICAgICAgICAgIGlmICghYWN0aXZlX2xlYWYpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBhY3RpdmUgbGVhZlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IGFjdGl2ZV9sZWFmLm9wZW5GaWxlKGNyZWF0ZWRfbm90ZSwge3N0YXRlOiB7bW9kZTogJ3NvdXJjZSd9LCBlU3RhdGU6IHtyZW5hbWU6ICdhbGwnfX0pO1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmN1cnNvcl9qdW1wZXIuanVtcF90b19uZXh0X2N1cnNvcl9sb2NhdGlvbigpO1xuICAgICAgICB9XG5cdFx0Y2F0Y2goZXJyb3IpIHtcblx0XHRcdHRoaXMucGx1Z2luLmxvZ19lcnJvcihlcnJvcik7XG5cdFx0fVxuICAgIH1cblxuICAgIGFzeW5jIHJlcGxhY2VfdGVtcGxhdGVzX2FuZF9hcHBlbmQodGVtcGxhdGVfZmlsZTogVEZpbGUpIHtcbiAgICAgICAgbGV0IGFjdGl2ZV92aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICAgICAgaWYgKGFjdGl2ZV92aWV3ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBhY3RpdmUgdmlldywgY2FuJ3QgYXBwZW5kIHRlbXBsYXRlcy5cIik7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZWRpdG9yID0gYWN0aXZlX3ZpZXcuZWRpdG9yO1xuICAgICAgICBsZXQgZG9jID0gZWRpdG9yLmdldERvYygpO1xuXG4gICAgICAgIGxldCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZCh0ZW1wbGF0ZV9maWxlKTtcblxuICAgICAgICBhd2FpdCB0aGlzLnNldEN1cnJlbnRDb250ZXh0KGFjdGl2ZV92aWV3LmZpbGUsIENvbnRleHRNb2RlLlVTRVJfSU5URVJOQUwpO1xuICAgICAgICBjb250ZW50ID0gYXdhaXQgdGhpcy5wYXJzZVRlbXBsYXRlcyhjb250ZW50KTtcbiAgICAgICAgXG4gICAgICAgIGRvYy5yZXBsYWNlU2VsZWN0aW9uKGNvbnRlbnQpO1xuXG4gICAgICAgIGF3YWl0IHRoaXMuY3Vyc29yX2p1bXBlci5qdW1wX3RvX25leHRfY3Vyc29yX2xvY2F0aW9uKCk7XG4gICAgICAgIGVkaXRvci5mb2N1cygpO1xuICAgIH1cblxuICAgIGFzeW5jIHJlcGxhY2VfdGVtcGxhdGVzX2FuZF9vdmVyd3JpdGVfaW5fZmlsZShmaWxlOiBURmlsZSkge1xuICAgICAgICBsZXQgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cbiAgICAgICAgYXdhaXQgdGhpcy5zZXRDdXJyZW50Q29udGV4dChmaWxlLCBDb250ZXh0TW9kZS5VU0VSX0lOVEVSTkFMKTtcbiAgICAgICAgbGV0IG5ld19jb250ZW50ID0gYXdhaXQgdGhpcy5wYXJzZVRlbXBsYXRlcyhjb250ZW50KTtcblxuICAgICAgICBpZiAobmV3X2NvbnRlbnQgIT09IGNvbnRlbnQpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCBuZXdfY29udGVudCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpID09PSBmaWxlKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5jdXJzb3JfanVtcGVyLmp1bXBfdG9fbmV4dF9jdXJzb3JfbG9jYXRpb24oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn0iLCJpbXBvcnQgeyBhZGRJY29uLCBNYXJrZG93blZpZXcsIE1lbnUsIE1lbnVJdGVtLCBOb3RpY2UsIFBsdWdpbiwgVEFic3RyYWN0RmlsZSwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XHJcblxyXG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTLCBUZW1wbGF0ZXJTZXR0aW5ncywgVGVtcGxhdGVyU2V0dGluZ1RhYiB9IGZyb20gJ1NldHRpbmdzJztcclxuaW1wb3J0IHsgVGVtcGxhdGVyRnV6enlTdWdnZXN0TW9kYWwgfSBmcm9tICdUZW1wbGF0ZXJGdXp6eVN1Z2dlc3QnO1xyXG5pbXBvcnQgeyBDb250ZXh0TW9kZSwgVGVtcGxhdGVQYXJzZXIgfSBmcm9tICdUZW1wbGF0ZVBhcnNlcic7XHJcbmltcG9ydCB7IElDT05fREFUQSB9IGZyb20gJ0NvbnN0YW50cyc7XHJcbmltcG9ydCB7IGRlbGF5IH0gZnJvbSAnVXRpbHMnO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGVtcGxhdGVyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuXHRwdWJsaWMgZnV6enlTdWdnZXN0OiBUZW1wbGF0ZXJGdXp6eVN1Z2dlc3RNb2RhbDtcclxuXHRwdWJsaWMgc2V0dGluZ3M6IFRlbXBsYXRlclNldHRpbmdzOyBcclxuXHRwdWJsaWMgcGFyc2VyOiBUZW1wbGF0ZVBhcnNlclxyXG5cclxuXHRhc3luYyBvbmxvYWQoKSB7XHJcblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG5cclxuXHRcdHRoaXMuZnV6enlTdWdnZXN0ID0gbmV3IFRlbXBsYXRlckZ1enp5U3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcclxuXHRcdHRoaXMucGFyc2VyID0gbmV3IFRlbXBsYXRlUGFyc2VyKHRoaXMuYXBwLCB0aGlzKTtcclxuXHJcblx0XHR0aGlzLnJlZ2lzdGVyTWFya2Rvd25Qb3N0UHJvY2Vzc29yKChlbCwgY3R4KSA9PiB0aGlzLmR5bmFtaWNfdGVtcGxhdGVzX3Byb2Nlc3NvcihlbCwgY3R4KSk7XHJcblxyXG5cdFx0YWRkSWNvbihcInRlbXBsYXRlci1pY29uXCIsIElDT05fREFUQSk7XHJcblx0XHR0aGlzLmFkZFJpYmJvbkljb24oJ3RlbXBsYXRlci1pY29uJywgJ1RlbXBsYXRlcicsIGFzeW5jICgpID0+IHtcclxuXHRcdFx0dGhpcy5mdXp6eVN1Z2dlc3QuaW5zZXJ0X3RlbXBsYXRlKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmFkZENvbW1hbmQoe1xyXG5cdFx0XHRpZDogXCJpbnNlcnQtdGVtcGxhdGVyXCIsXHJcblx0XHRcdG5hbWU6IFwiSW5zZXJ0IFRlbXBsYXRlXCIsXHJcblx0XHRcdGhvdGtleXM6IFtcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRtb2RpZmllcnM6IFtcIkFsdFwiXSxcclxuXHRcdFx0XHRcdGtleTogJ2UnLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdF0sXHJcblx0XHRcdGNhbGxiYWNrOiAoKSA9PiB7XHJcblx0XHRcdFx0dGhpcy5mdXp6eVN1Z2dlc3QuaW5zZXJ0X3RlbXBsYXRlKCk7XHJcblx0XHRcdH0sXHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICAgICAgICBpZDogXCJyZXBsYWNlLWluLWZpbGUtdGVtcGxhdGVyXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiUmVwbGFjZSB0ZW1wbGF0ZXMgaW4gdGhlIGFjdGl2ZSBmaWxlXCIsXHJcbiAgICAgICAgICAgIGhvdGtleXM6IFtcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBtb2RpZmllcnM6IFtcIkFsdFwiXSxcclxuICAgICAgICAgICAgICAgICAgICBrZXk6ICdyJyxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XHJcblx0XHRcdFx0dGhpcy5wYXJzZXIucmVwbGFjZV9pbl9hY3RpdmVfZmlsZSgpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XHJcblx0XHRcdGlkOiBcImp1bXAtdG8tbmV4dC1jdXJzb3ItbG9jYXRpb25cIixcclxuXHRcdFx0bmFtZTogXCJKdW1wIHRvIG5leHQgY3Vyc29yIGxvY2F0aW9uXCIsXHJcblx0XHRcdGhvdGtleXM6IFtcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRtb2RpZmllcnM6IFtcIkFsdFwiXSxcclxuXHRcdFx0XHRcdGtleTogXCJUYWJcIixcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRdLFxyXG5cdFx0XHRjYWxsYmFjazogKCkgPT4ge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcnNlci5jdXJzb3JfanVtcGVyLmp1bXBfdG9fbmV4dF9jdXJzb3JfbG9jYXRpb24oKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2F0Y2goZXJyb3IpIHtcclxuXHRcdFx0XHRcdHRoaXMubG9nX2Vycm9yKGVycm9yKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XHJcblx0XHRcdGlkOiBcImNyZWF0ZS1uZXctbm90ZS1mcm9tLXRlbXBsYXRlXCIsXHJcblx0XHRcdG5hbWU6IFwiQ3JlYXRlIG5ldyBub3RlIGZyb20gdGVtcGxhdGVcIixcclxuXHRcdFx0aG90a2V5czogW1xyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG1vZGlmaWVyczogW1wiQWx0XCJdLFxyXG5cdFx0XHRcdFx0a2V5OiBcIm5cIixcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRdLFxyXG5cdFx0XHRjYWxsYmFjazogKCkgPT4ge1xyXG5cdFx0XHRcdHRoaXMuZnV6enlTdWdnZXN0LmNyZWF0ZV9uZXdfbm90ZV9mcm9tX3RlbXBsYXRlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcclxuXHRcdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxyXG5cdFx0XHRcdC8vIFRPRE86IEZpbmQgYSB3YXkgdG8gbm90IHRyaWdnZXIgdGhpcyBvbiBmaWxlcyBjb3B5XHJcblx0XHRcdFx0dGhpcy5hcHAudmF1bHQub24oXCJjcmVhdGVcIiwgYXN5bmMgKGZpbGU6IFRBYnN0cmFjdEZpbGUpID0+IHtcclxuXHRcdFx0XHRcdC8vIFRPRE86IGZpbmQgYSBiZXR0ZXIgd2F5IHRvIGRvIHRoaXNcclxuXHRcdFx0XHRcdC8vIEN1cnJlbnRseSwgSSBoYXZlIHRvIHdhaXQgZm9yIHRoZSBkYWlseSBub3RlIHBsdWdpbiB0byBhZGQgdGhlIGZpbGUgY29udGVudCBiZWZvcmUgcmVwbGFjaW5nXHJcblx0XHRcdFx0XHQvLyBOb3QgYSBwcm9ibGVtIHdpdGggQ2FsZW5kYXIgaG93ZXZlciBzaW5jZSBpdCBjcmVhdGVzIHRoZSBmaWxlIHdpdGggdGhlIGV4aXN0aW5nIGNvbnRlbnRcclxuXHRcdFx0XHRcdGF3YWl0IGRlbGF5KDMwMCk7XHJcblx0XHRcdFx0XHQvLyAhIFRoaXMgY291bGQgY29ycnVwdCBiaW5hcnkgZmlsZXNcclxuXHRcdFx0XHRcdGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkgfHwgZmlsZS5leHRlbnNpb24gIT09IFwibWRcIikge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR0aGlzLnBhcnNlci5yZXBsYWNlX3RlbXBsYXRlc19hbmRfb3ZlcndyaXRlX2luX2ZpbGUoZmlsZSk7XHJcblx0XHRcdFx0fSlcclxuXHRcdFx0KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcclxuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1tZW51XCIsIChtZW51OiBNZW51LCBmaWxlOiBURmlsZSkgPT4ge1xyXG5cdFx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikge1xyXG5cdFx0XHRcdFx0bWVudS5hZGRJdGVtKChpdGVtOiBNZW51SXRlbSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpdGVtLnNldFRpdGxlKFwiQ3JlYXRlIG5ldyBub3RlIGZyb20gdGVtcGxhdGVcIilcclxuXHRcdFx0XHRcdFx0XHQuc2V0SWNvbihcInRlbXBsYXRlci1pY29uXCIpXHJcblx0XHRcdFx0XHRcdFx0Lm9uQ2xpY2soZXZ0ID0+IHtcclxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuZnV6enlTdWdnZXN0LmNyZWF0ZV9uZXdfbm90ZV9mcm9tX3RlbXBsYXRlKGZpbGUpO1xyXG5cdFx0XHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHQpO1xyXG5cclxuXHRcdHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgVGVtcGxhdGVyU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cdH1cclxuXHJcblx0YXN5bmMgc2F2ZVNldHRpbmdzKCkge1xyXG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuXHR9XHJcblxyXG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuXHRcdHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xyXG5cdH1cdFxyXG5cclxuXHRsb2dfdXBkYXRlKG1zZzogc3RyaW5nKSB7XHJcblx0XHRsZXQgbm90aWNlID0gbmV3IE5vdGljZShcIlwiLCAxNTAwMCk7XHJcblx0XHQvLyBUT0RPOiBGaW5kIGJldHRlciB3YXkgZm9yIHRoaXNcclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdG5vdGljZS5ub3RpY2VFbC5pbm5lckhUTUwgPSBgPGI+VGVtcGxhdGVyIHVwZGF0ZTwvYj46ICR7bXNnfWA7XHJcblx0fVxyXG5cclxuXHRsb2dfZXJyb3IobXNnOiBzdHJpbmcsIGVycm9yPzogc3RyaW5nKSB7XHJcblx0XHRsZXQgbm90aWNlID0gbmV3IE5vdGljZShcIlwiLCA4MDAwKTtcclxuXHRcdGlmIChlcnJvcikge1xyXG5cdFx0XHQvLyBUT0RPOiBGaW5kIGEgYmV0dGVyIHdheSBmb3IgdGhpc1xyXG5cdFx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRcdG5vdGljZS5ub3RpY2VFbC5pbm5lckhUTUwgPSBgPGI+VGVtcGxhdGVyIEVycm9yPC9iPjogJHttc2d9PGJyLz5DaGVjayBjb25zb2xlIGZvciBtb3JlIGluZm9ybWF0aW9uc2A7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IobXNnLCBlcnJvcik7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0XHRub3RpY2Uubm90aWNlRWwuaW5uZXJIVE1MID0gYDxiPlRlbXBsYXRlciBFcnJvcjwvYj46ICR7bXNnfWA7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRhc3luYyBkeW5hbWljX3RlbXBsYXRlc19wcm9jZXNzb3IoZWw6IEhUTUxFbGVtZW50LCBjdHg6IGFueSkge1xyXG5cdFx0aWYgKGVsLnRleHRDb250ZW50LmNvbnRhaW5zKFwidHAuZHluYW1pY1wiKSkge1xyXG5cdFx0XHQvLyBUT0RPOiBUaGlzIHdpbGwgbm90IGFsd2F5cyBiZSB0aGUgYWN0aXZlIGZpbGUsIFxyXG5cdFx0XHQvLyBJIG5lZWQgdG8gdXNlIGdldEZpcnN0TGlua3BhdGhEZXN0IGFuZCBjdHggdG8gZmluZCB0aGUgYWN0dWFsIGZpbGVcclxuXHRcdFx0bGV0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xyXG5cdFx0XHRhd2FpdCB0aGlzLnBhcnNlci5zZXRDdXJyZW50Q29udGV4dChmaWxlLCBDb250ZXh0TW9kZS5EWU5BTUlDKTtcclxuXHRcdFx0bGV0IG5ld19odG1sID0gYXdhaXQgdGhpcy5wYXJzZXIucGFyc2VUZW1wbGF0ZXMoZWwuaW5uZXJIVE1MKTtcclxuXHRcdFx0ZWwuaW5uZXJIVE1MID0gbmV3X2h0bWw7XHJcblx0XHR9XHJcblx0fVxyXG59OyJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsImVzY2FwZVJlZ0V4cCIsIm5vcm1hbGl6ZVBhdGgiLCJURm9sZGVyIiwiVmF1bHQiLCJURmlsZSIsIkZ1enp5U3VnZ2VzdE1vZGFsIiwicGF0aCIsImV4aXN0c1N5bmMiLCJyZWFkRmlsZVN5bmMiLCJGaWxlU3lzdGVtQWRhcHRlciIsIk1hcmtkb3duVmlldyIsImdldEFsbFRhZ3MiLCJNb2RhbCIsInByb21pc2lmeSIsImV4ZWMiLCJFdGEucmVuZGVyQXN5bmMiLCJQbHVnaW4iLCJhZGRJY29uIiwiTm90aWNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBdURBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtB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
