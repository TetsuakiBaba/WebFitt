/*******************************************************
 * script.js
 *******************************************************/

class Task {
    constructor(A, W, n, t, cn) {
        this.A = A;     // 振幅(ピクセル)
        this.W = W;     // ターゲット幅(ピクセル)
        this.n = n;     // ターゲット数
        this.t = t;     // 周回数(何周分クリックするか)
    }
}

let n_condition = 1;
var condition_codes = [];
let current_condition = 1;


class Pos {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

var tasks = [];
var uncalibratedTasks = [];
var taskIdx = 0;

var clickNumber = 0;

var isMute = true;
var isTrailing = false;
var isTaskRunning = false;
var isTaskFinished = false;
var beginFlag = false;

var isCalibrating = false;
var calibrationScale = 1;
let calibrationSlider;

var participantCode = "";
var sessionCode = "";
var conditionCode = "";
var handDominance = "";
var pointingDevice = "";
var deviceExperience = "";

var lastClickTime = 0;
var currentClickTime = 0;

var clickData = [];
var aggregateTaskResult = [];
var overallMeanResult = [];
var servdown = false;
var resultsview = true;

// それぞれのCSV出力用ヘッダー
let clickDataHeader = [
    "Participant Code", "Session Code", "Condition Code", "Hand Dominance", "Pointing Device", "Device Experience",
    "Amplitude", "Width", "Number of Targets", "Task Index", "Click Number", "Completion Time (ms)",
    "Source X", "Source Y", "Target X", "Target Y", "Click X", "Click Y", "Source-Target Distance", "dx", "Incorrect"
];
let aggregateTaskResultHeader = [
    "Participant Code", "Session Code", "Condition Code", "Hand Dominance", "Pointing Device", "Device Experience",
    "Amplitude", "Width", "Number of Targets", "Task Index", "Mean Completion Time (ms)", "Error (%)",
    "SDx", "We", "IDe", "Ae", "Throughput (bps)"
];
let overallMeanResultHeader = [
    "Participant Code", "Session Code", "Condition Code", "Hand Dominance", "Pointing Device", "Device Experience",
    "Mean Completion Time (ms)", "Mean Click Error (%)", "Mean Throughput (bps)"
];

function getParameters() {

    if (condition_codes.length > 0) {
        let as = condition_codes.map(item => item.amplitude).join(",");
        let ws = condition_codes.map(item => item.width).join(",");
        let n = document.getElementById("number-of-targets").value;
        let t = document.getElementById("number-of-trials").value;
        condition_codes.shift();
        console.log(condition_codes);
        return {
            as: as,
            ws: ws,
            n: n,
            t: t,
        }
    }
}


$(document).ready(function () {
    $("#main_menu").hide();

    // condition codeのoption数を取得
    n_condition = $("#condition-code option").length;


    // サーバー保存設定の取得
    if ($("#webfitt-meta").data()["servdown"] == "True") {
        servdown = true;
    }

    // 実験完了後の結果表示の有無
    if ($("#webfitt-meta").data()["resultsview"] == "False") {
        resultsview = false;
    }

    // GitHub ロゴ hover
    $("#github_logo").hover(function () {
        $("#github_logo").attr("src", "assets/github_hover.png");
    }, function () {
        $("#github_logo").attr("src", "assets/github_default.png");
    });

    // ヘッダーロゴ hover
    $("#header_logo").hover(function () {
        $("#header_logo").attr("src", "assets/header_logo_hover.png");
    }, function () {
        $("#header_logo").attr("src", "assets/header_logo.png");
    });

    // キャリブレーションアイコン hover
    $("#calibration_icon").hover(function () {
        $("#calibration_icon").attr("src", "assets/calibrate_hover.png");
    }, function () {
        $("#calibration_icon").attr("src", "assets/calibrate.png");
    });

    // ボリュームアイコン hover
    $("#volume_icon").hover(function () {
        renderVolumeImage(true);
    }, function () {
        renderVolumeImage(false);
    });

    // トレイルアイコン hover
    $("#trail_icon").hover(function () {
        renderTrailImage(true);
    }, function () {
        renderTrailImage(false);
    });

    // キャンバス上のクリックイベント
    $(document).on("click", "canvas", function () {
        if (isTaskRunning) {
            onCanvasClick();
        }
    });

    // UI要素のクリックイベント
    $(document).on("click", ".ui_item", function () {
        var id = $(this).attr("id");
        if (id == "volume_icon") {
            isMute = !isMute;
            renderVolumeImage(true);
        }
        else if (id == "trail_icon") {
            isTrailing = !isTrailing;
            renderTrailImage(true);
        }
        else if (id == "calibration_icon") {
            beginCalibration();
        }
    });

    $(document).on("click", "#confirm_calibration_btn", function () {
        setCalibrationValue();
        if (getCookie("webfitt-calibration") == "") {
            $('#calibration-modal').modal('show');
        } else {
            setCalibrationCookie(calibrationScale);
            $('#calibrated-modal').modal('show');
        }
    });

    // ヘッダーロゴクリックでリロード
    $("#header_logo").click(function () {
        window.location.reload();
    });

    // GitHubロゴクリックでGitHubページを開く
    $("#github_logo").click(function () {
        window.open("https://github.com/adildsw/WebFitt");
    });

    $('#calibration-modal').modal({
        closable: false,
        onApprove: function () {
            setCalibrationCookie(calibrationScale);
            endCalibration();
            return true;
        },
        onDeny: function () {
            endCalibration();
            return true;
        }
    });

    $('#calibrated-modal').modal({
        closable: false,
        onApprove: function () {
            setCalibrationCookie(calibrationScale);
            endCalibration();
            return true;
        }
    });



    // Start Test ボタン押下時の処理
    $(document).on("click", "#start-test-btn", function () {
        participantCode = $("#participant-code").val();
        sessionCode = $("#session-code").val();
        conditionCode = $("#condition-code").val();
        handDominance = $("input[name='hand-dominance']:checked").val();
        pointingDevice = $("input[name='pointing-device']:checked").val();
        deviceExperience = $("input[name='device-experience']:checked").val();

        let ps = getParameters();
        var A_raw = document.getElementById("amplitude").value;
        var W_raw = document.getElementById("width").value;
        var n = document.getElementById("number-of-targets").value;
        var t = document.getElementById("number-of-trials").value;

        var policy = false;
        if ($("#policy").is(":checked")) {
            policy = true;
        }
        var A = A_raw.replace(" ", '').split(",");
        var W = W_raw.replace(" ", '').split(",");


        var correctFlag = true;
        var errorMsg = "";

        // 必須入力チェック
        if (participantCode == "") {
            correctFlag = false;
            errorMsg = "ERROR: Participant Code is empty.";
        }
        if (sessionCode == "") {
            correctFlag = false;
            errorMsg = "ERROR: Session Code is empty.";
        }
        if (conditionCode == "") {
            correctFlag = false;
            errorMsg = "ERROR: Condition Code is empty.";
        }
        if (A.length == 0) {
            correctFlag = false;
            errorMsg = "ERROR: Amplitude is empty.";
        }
        if (W.length == 0) {
            correctFlag = false;
            errorMsg = "ERROR: Width is empty.";
        }
        if (isNaN(n) || n < 1) {
            correctFlag = false;
            errorMsg = "ERROR: Number of Targets is invalid.";
        }
        if (isNaN(t) || t < 1) {
            correctFlag = false;
            errorMsg = "ERROR: Number of Trials is invalid.";
        }

        // 数値配列に変換
        if (isArrayOfNumbers(A)) {
            A = parseArrayOfNumbers(A);
        } else {
            correctFlag = false;
            errorMsg = "ERROR: Incorrect amplitude value(s) entered."
        }
        if (isArrayOfNumbers(W)) {
            W = parseArrayOfNumbers(W);
        } else {
            correctFlag = false;
            errorMsg = "ERROR: Incorrect width value(s) entered."
        }

        // サーバー保存の場合は同意必須
        if (!policy && servdown) {
            correctFlag = false;
            errorMsg = "ERROR: Data usage policy agreement is required."
        }

        if (correctFlag) {
            // メインメニューを隠す
            $("#main_menu").hide();
            // 実験開始
            beginApp(A, W, n, t);

            // beginApp(["100", "200"], ["50", "100"], 5, 2);

        } else {
            alert(errorMsg);
        }
    });

    // header logoは初期表示隠す
    $("#header_logo").hide();

    // サーバー保存がfalseの場合、データポリシーUIを隠す
    if (!servdown) {
        $(".servdown-policy").hide();
    }
});

function setCalibrationCookie(calibrationScale) {
    setCookie("webfitt-calibration", calibrationScale, 365);
}

function beginCalibration() {
    isCalibrating = true;
    $("#main_menu").hide();
    $(".ui_item").hide();
    $("#header_logo").show();
    $("#confirm_calibration_btn").show();
    slider.value(calibrationScale);
}

function endCalibration() {
    isCalibrating = false;
    $("#main_menu").show();
    $(".ui_item").show();
    $("#header_logo").hide();
    $("#confirm_calibration_btn").hide();
    slider.value(calibrationScale);
    slider.style('display', 'none');
}

/*
 * 実験開始: A, W の組み合わせごとにタスクを生成し、シャッフルする
 * a_list, w_list: 配列
 * n: ターゲット数
 * t: 何周分(何倍)行うか
 */
function beginApp(a_list, w_list, n, t) {
    taskIdx = 0;
    clickNumber = 0;
    clickData = [];
    aggregateTaskResult = [];
    overallMeanResult = [];

    tasks = generateTaskSequence(a_list, w_list, n, t);
    uncalibratedTasks = generateUncalibratedTaskSequence(a_list, w_list, n, t);

    // シャッフル
    for (var i = tasks.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
        [uncalibratedTasks[i], uncalibratedTasks[j]] = [uncalibratedTasks[j], uncalibratedTasks[i]];
    }

    if (tasks.length == 0) {
        alert("ERROR: No task to run.");
    } else {
        isTaskRunning = true;
        $("#header_logo").show();
    }

    current_condition++;
}

// p5.js のプリロード
function preload() {
    creditCardImg = loadImage("assets/credit_card.png");
    robotoLightFont = loadFont("./assets/roboto-light.ttf");
    robotoRegularFont = loadFont("./assets/roboto-regular.ttf");
    correctAudio = loadSound("assets/correct_audio.mp3");
    incorrectAudio = loadSound("assets/incorrect_audio.mp3");
    correctAudio.setVolume(0.2);
    incorrectAudio.setVolume(0.2);
}

// p5.js のセットアップ
function setup() {
    createCanvas(windowWidth, windowHeight);
    frameRate(60);
    background(255);

    slider = createSlider(0.5, 2, 1, 0.01);
    slider.style('width', '200px');
    slider.style('display', 'none');
    slider.position(width / 2 - 100, height / 2 + 320);
    $("#confirm_calibration_btn").css({ 'width': 150, 'top': height / 2 + 350, 'left': width / 2 - 75 });

    // 既にキャリブレーション済みかどうか
    if (isDisplayCalibrated()) {
        calibrationScale = getCalibrationValue();
    } else {
        beginCalibration();
    }
}

// p5.js のループ
function draw() {
    background(255);

    if (isCalibrating) {
        renderCalibrationPanel();
    }
    else if (isTaskRunning) {
        renderTrail();
        runPipeline();
        renderInfoText();
    }
    else if (isTaskFinished) {
        if (resultsview) {
            renderTaskCompleteMessage();
        } else {
            window.location.reload();
        }
    }
    else {
        $("#main_menu").show();
    }
}

// ディスプレイキャリブレーション画面の描画
function renderCalibrationPanel() {
    background(255);

    noStroke();
    textSize(64);
    fill(0);
    textFont(robotoRegularFont);
    textAlign(CENTER, CENTER);
    text("Display Calibration", width / 2, 140);
    textFont(robotoLightFont);
    textSize(32);
    text("Please adjust the slider below so that the card on your screen matches a physical credit card.", width / 2, 210);

    let val = slider.value();
    slider.style('display', 'block');

    let cardWidth = 500 * val;
    let cardHeight = cardWidth / 1.586;
    image(creditCardImg, (width / 2) - (cardWidth / 2), (height / 2) - (cardHeight / 2) + 30, cardWidth, cardHeight);
}

/*
 * 1フレームごとの実験進行管理
 * ターゲットを描画し、(n×t) + 1 回クリックでタスク終了 → 次タスクへ
 */
function runPipeline() {
    var A = tasks[taskIdx].A;
    var W = tasks[taskIdx].W;
    var n = tasks[taskIdx].n;
    var t = tasks[taskIdx].t; // 周回数
    var mainTarget = getTargetIdxFromClickNumber(clickNumber, n);
    renderTargets(A, W, n, mainTarget);

    // 1タスクあたり n×t 回クリックしたら次へ (n×t+1 回目で終了処理)
    if (clickNumber == n * t + 1) {
        if (taskIdx < tasks.length - 1) {
            taskIdx++;
        } else {
            // 全タスク終了
            isTaskRunning = false;
            isTaskFinished = true;
            computeAggregateTaskResult();
            computeOverallMeanResult();
            var filename = "WebFitts_" + participantCode + "_" + sessionCode + "_" + conditionCode + "_" + pointingDevice;
            saveAsZipFile(filename);
            if (servdown) {
                uploadResult();
            }
        }
        clickNumber = 0;
        beginFlag = false;
    }
}

// キャンバス上クリック時の処理
function onCanvasClick() {
    var A = tasks[taskIdx].A;
    var W = tasks[taskIdx].W;
    var n = tasks[taskIdx].n;
    var mainTarget = getTargetIdxFromClickNumber(clickNumber, n);
    var clickPos = new Pos(mouseX, mouseY);

    var correct = isClickCorrect(A, W, n, mainTarget, clickPos);
    if (correct && !isMute) {
        correctAudio.play();
    }
    else if (beginFlag && !isMute) {
        incorrectAudio.play();
    }

    // 最初の正解クリックまでは開始合図
    if (correct && !beginFlag) {
        beginFlag = true;
        lastClickTime = millis();
        currentClickTime = lastClickTime;
        clickNumber++;
    }
    else if (beginFlag) {
        currentClickTime = millis();
        computeClickData(clickPos);
        clickNumber++;
        lastClickTime = currentClickTime;
    }
}

// タスクシーケンス(キャリブレーション適用)生成
function generateTaskSequence(a_list, w_list, n, t) {
    var a_list_temp = [];
    var w_list_temp = [];
    for (var i = 0; i < a_list.length; i++) {
        a_list_temp.push(a_list[i] * calibrationScale);
    }
    for (var i = 0; i < w_list.length; i++) {
        w_list_temp.push(w_list[i] * calibrationScale);
    }

    var taskSequence = [];
    for (var i = 0; i < a_list_temp.length; i++) {
        for (var j = 0; j < w_list_temp.length; j++) {
            taskSequence.push(new Task(a_list_temp[i], w_list_temp[j], n, t));
        }
    }
    return taskSequence;
}

// タスクシーケンス(キャリブレーション前値)生成
function generateUncalibratedTaskSequence(a_list, w_list, n, t) {
    var taskSequence = [];
    for (var i = 0; i < a_list.length; i++) {
        for (var j = 0; j < w_list.length; j++) {
            taskSequence.push(new Task(a_list[i], w_list[j], n, t));
        }
    }
    return taskSequence;
}

// クリックが正解ターゲット内かどうか
function isClickCorrect(A, W, n, mainTarget, clickPos) {
    var pos = getTargetPosition(A, n, mainTarget);
    var dist = sqrt(pow(clickPos.x - pos.x, 2) + pow(clickPos.y - pos.y, 2));
    return (dist < W / 2);
}

// キーボード操作 (トレイルon/off, ミュートon/off)
function keyPressed() {
    if (key === 't') {
        isTrailing = !isTrailing;
        renderTrailImage(false);
    }
    else if (key == 's') {
        isMute = !isMute;
        renderVolumeImage(false);
    }
}

// トレイル描画
function renderTrail() {
    if (!isTrailing || !beginFlag) {
        background(255);
    }
    if (isTrailing && beginFlag) {
        noStroke();
        fill("#AAAAAA");
        circle(mouseX, mouseY, 2);
        stroke("#AAAAAA");
        strokeWeight(2);
        line(mouseX, mouseY, pmouseX, pmouseY);
    }
}

// 右上の情報テキスト表示
function renderInfoText() {
    noStroke();
    textSize(28);
    fill(0);
    textFont(robotoRegularFont);
    textAlign(LEFT, TOP);
    text("Task " + (taskIdx + 1) + " of " + tasks.length, width - 400, 50);
    textFont(robotoLightFont);
    text(
        "Amplitude " + uncalibratedTasks[taskIdx].A +
        " | Width " + uncalibratedTasks[taskIdx].W +
        " | \n" + uncalibratedTasks[taskIdx].n + " Targets × " + uncalibratedTasks[taskIdx].t + " Trials",
        width - 400, 85
    );
    // 最初のクリックの場合は開始合図を表示
    if (!beginFlag) {

        textSize(24);
        textAlign(LEFT, CENTER);
        textFont(robotoRegularFont);
        text("<- Click to start the task.", 20 + getTargetPosition(tasks[taskIdx].A, tasks[taskIdx].n, 0).x, height / 2);
    }
}

// タスク完了メッセージ
function renderTaskCompleteMessage() {
    background(255);

    noStroke();
    textSize(28);
    fill(0);
    textFont(robotoRegularFont);
    textAlign(LEFT);
    text("Overall Mean Result", width - 400, 50);
    textFont(robotoLightFont);
    text("Mean Time (ms): " + overallMeanResult[0][6].toFixed(2), width - 400, 85);
    text("Mean Error (%): " + overallMeanResult[0][7].toFixed(2), width - 400, 120);
    text("Mean Throughput (bps): " + overallMeanResult[0][8].toFixed(2), width - 400, 155);

    noStroke();
    textSize(64);
    fill(0);
    textFont(robotoLightFont);
    textAlign(CENTER, CENTER);
    if (tasks.length == 1) {
        text("Task Complete!", width / 2, height / 2);
    }
    else {
        text("Tasks Complete!", width / 2, height / 2);
    }

    if (servdown) {
        textSize(16);
        text("A copy of your result has been uploaded to the server.", width / 2, (height / 2) + 60);
    }
}

// クリックデータを計算して配列に保存
function computeClickData(clickPos) {
    var A = uncalibratedTasks[taskIdx].A;
    var W = uncalibratedTasks[taskIdx].W;
    var n = uncalibratedTasks[taskIdx].n;
    var clickTime = currentClickTime - lastClickTime;
    var sourcePos = getTargetPosition(A, n, getTargetIdxFromClickNumber(clickNumber - 1, n));
    var targetPos = getTargetPosition(A, n, getTargetIdxFromClickNumber(clickNumber, n));

    var sourceTargetDist = sqrt(pow(sourcePos.x - targetPos.x, 2) + pow(sourcePos.y - targetPos.y, 2));
    var sourceClickDist = sqrt(pow(clickPos.x - sourcePos.x, 2) + pow(clickPos.y - sourcePos.y, 2));
    var targetClickDist = sqrt(pow(clickPos.x - targetPos.x, 2) + pow(clickPos.y - targetPos.y, 2));
    var dx = ((sourceClickDist * sourceClickDist) - (targetClickDist * targetClickDist) - (sourceTargetDist * sourceTargetDist)) / (2 * sourceTargetDist);
    var isIncorrect = isClickCorrect(tasks[taskIdx].A, tasks[taskIdx].W, n, getTargetIdxFromClickNumber(clickNumber, n), clickPos) ? 0 : 1;

    var data = [];
    data.push(participantCode);
    data.push(sessionCode);
    data.push(conditionCode);
    data.push(handDominance);
    data.push(pointingDevice);
    data.push(deviceExperience);
    data.push(A);
    data.push(W);
    data.push(n);
    data.push(taskIdx);
    data.push(clickNumber);
    data.push(clickTime);
    data.push(sourcePos.x);
    data.push(sourcePos.y);
    data.push(targetPos.x);
    data.push(targetPos.y);
    data.push(clickPos.x);
    data.push(clickPos.y);
    data.push(sourceTargetDist);
    data.push(dx);
    data.push(isIncorrect);

    clickData.push(data);
}

// タスクごとの集計
function computeAggregateTaskResult() {
    for (var i = 0; i < tasks.length; i++) {
        var A = uncalibratedTasks[i].A;
        var W = uncalibratedTasks[i].W;
        var n = uncalibratedTasks[i].n;
        var t = uncalibratedTasks[i].t; // ★周回数
        var totalClicksThisTask = n * t; // ★1タスクあたりの総クリック数

        var clickTimeList = [];
        var errorList = [];
        var dxList = [];
        var avgEffectiveAmplitudeList = [];

        // i番目タスクのクリックデータ範囲
        for (var j = i * totalClicksThisTask; j < (i + 1) * totalClicksThisTask; j++) {
            if (!clickData[j]) {
                break;
            }
            clickTimeList.push(clickData[j][11]);            // Completion Time
            errorList.push(clickData[j][20]);               // Incorrect
            dxList.push(clickData[j][19]);                  // dx
            avgEffectiveAmplitudeList.push(clickData[j][18] + clickData[j][19]); // Ae = Distance + dx
        }

        // クリックデータが足りない(未完了)ならスキップ
        if (clickTimeList.length < totalClicksThisTask) {
            continue;
        }

        var meanTime = computeMean(clickTimeList);
        var error = computeMean(errorList) * 100;
        var sdx = computeStandardDeviation(dxList);
        var ae = computeMean(avgEffectiveAmplitudeList);
        var we = 4.133 * sdx;
        var ide = Math.log2(ae / we + 1.0);
        var throughput = ide * 1000 / meanTime;

        var aggRes = [];
        aggRes.push(participantCode);
        aggRes.push(sessionCode);
        aggRes.push(conditionCode);
        aggRes.push(handDominance);
        aggRes.push(pointingDevice);
        aggRes.push(deviceExperience);
        aggRes.push(A);
        aggRes.push(W);
        aggRes.push(n);
        aggRes.push(i);
        aggRes.push(meanTime);
        aggRes.push(error);
        aggRes.push(sdx);
        aggRes.push(we);
        aggRes.push(ide);
        aggRes.push(ae);
        aggRes.push(throughput);

        aggregateTaskResult.push(aggRes);
    }
}

// 全体平均の集計
function computeOverallMeanResult() {
    var meanTimes = [];
    var errors = [];
    var throughputs = [];
    // aggregateTaskResult を対象にする
    for (var i = 0; i < aggregateTaskResult.length; i++) {
        meanTimes.push(aggregateTaskResult[i][10]);
        errors.push(aggregateTaskResult[i][11]);
        throughputs.push(aggregateTaskResult[i][16]);
    }
    var overallMeanTime = computeMean(meanTimes);
    var overallMeanError = computeMean(errors);
    var overallMeanThroughput = computeMean(throughputs);

    var ovRes = [];
    ovRes.push(participantCode);
    ovRes.push(sessionCode);
    ovRes.push(conditionCode);
    ovRes.push(handDominance);
    ovRes.push(pointingDevice);
    ovRes.push(deviceExperience);
    ovRes.push(overallMeanTime);
    ovRes.push(overallMeanError);
    ovRes.push(overallMeanThroughput);

    overallMeanResult.push(ovRes);
}

// 各種CSV文字列生成
function generateClickResultString() {
    var resultString = clickDataHeader.join(",") + "\n";
    for (var i = 0; i < clickData.length; i++) {
        resultString += clickData[i].join(",") + "\n";
    }
    return resultString;
}

function generateTaskResultString() {
    var resultString = aggregateTaskResultHeader.join(",") + "\n";
    for (var i = 0; i < aggregateTaskResult.length; i++) {
        resultString += aggregateTaskResult[i].join(",") + "\n";
    }
    return resultString;
}

function generateMeanResultString() {
    var resultString = overallMeanResultHeader.join(",") + "\n";
    for (var i = 0; i < overallMeanResult.length; i++) {
        resultString += overallMeanResult[i].join(",") + "\n";
    }
    return resultString;
}

// 結果をまとめて文字列化
function generateResultString() {
    var resultString = "";
    resultString = clickDataHeader.join(",") + "\n";
    for (var i = 0; i < clickData.length; i++) {
        resultString += clickData[i].join(",") + "\n";
    }
    resultString += "\n";
    resultString += aggregateTaskResultHeader.join(",") + "\n";
    for (var i = 0; i < aggregateTaskResult.length; i++) {
        resultString += aggregateTaskResult[i].join(",") + "\n";
    }
    resultString += "\n";
    resultString += overallMeanResultHeader.join(",") + "\n";
    for (var i = 0; i < overallMeanResult.length; i++) {
        resultString += overallMeanResult[i].join(",") + "\n";
    }
    return resultString;
}

// サーバーに結果を送信
function uploadResult() {
    var clickResult = generateClickResultString();
    var taskResult = generateTaskResultString();
    var meanResult = generateMeanResultString();

    var filename = "WebFitts_" + participantCode + "_" + sessionCode + "_" + conditionCode + "_" + pointingDevice;
    var data = "filename=" + filename + "&click_result=" + clickResult + "&mean_result=" + meanResult + "&task_result=" + taskResult;
    var url = "/saveResult";
    postRequest(url, data, function () {
        console.log("Result uploaded to server!");
    });
}

// ターゲット描画
function renderTargets(A, W, n, mainTarget) {
    // まず白で上書きして消す
    for (var i = 0; i < n; i++) {
        var pos = getTargetPosition(A, n, i);
        noStroke();
        fill("#FFFFFF");
        circle(pos.x, pos.y, W);
    }
    // 枠だけのサークルを描画
    for (var i = 0; i < n; i++) {
        var pos = getTargetPosition(A, n, i);
        stroke("#181818");
        strokeWeight(3);
        noFill();
        if (i == mainTarget) {
            fill("#3D9970");
        }
        circle(pos.x, pos.y, W);
    }
}

// クリック数→次のターゲットインデックスを計算
function getTargetIdxFromClickNumber(c, n) {
    var marker1 = -1;
    var marker2 = n / 2;
    if (n % 2 == 1) {
        marker2 = (n - 1) / 2;
    }
    var targetIdx = -1;

    for (var i = 0; i <= c; i++) {
        if (i % 2 == 0) {
            marker1++;
            marker1 = marker1 % n;
            targetIdx = marker1;
        } else {
            marker2++;
            marker2 = marker2 % n;
            targetIdx = marker2;
        }
    }
    return targetIdx;
}

// ターゲットの座標を計算
function getTargetPosition(A, n, idx) {
    var thetaX = 360 / n;
    var x = (width / 2) + cos(radians(idx * thetaX)) * A / 2;
    var y = (height / 2) + sin(radians(idx * thetaX)) * A / 2;
    return new Pos(x, y);
}

// ウィンドウリサイズ時
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    slider.position(width / 2 - 100, height / 2 + 320);
    $("#confirm_calibration_btn").css({ 'width': 150, 'top': height / 2 + 350, 'left': width / 2 - 75 });
}

// ボリューム画像の更新
function renderVolumeImage(isHovering) {
    if (isHovering) {
        if (isMute) {
            $("#volume_icon").attr("src", "assets/volume_mute_hover.png");
        }
        else {
            $("#volume_icon").attr("src", "assets/volume_on_hover.png");
        }
    }
    else {
        if (isMute) {
            $("#volume_icon").attr("src", "assets/volume_mute_default.png");
        }
        else {
            $("#volume_icon").attr("src", "assets/volume_on_default.png");
        }
    }
}

// トレイル画像の更新
function renderTrailImage(isHovering) {
    if (isHovering) {
        if (isTrailing) {
            $("#trail_icon").attr("src", "assets/trail_on_hover.png");
        }
        else {
            $("#trail_icon").attr("src", "assets/trail_off_hover.png");
        }
    }
    else {
        if (isTrailing) {
            $("#trail_icon").attr("src", "assets/trail_on_default.png");
        }
        else {
            $("#trail_icon").attr("src", "assets/trail_off_default.png");
        }
    }
}

// ディスプレイがキャリブレーション済みかどうか
function isDisplayCalibrated() {
    if (getCookie("webfitt-calibration") == "") return false;
    else return true;
}

// スライダー値をcookieに反映
function setCalibrationValue() {
    calibrationScale = slider.value();
}

function getCalibrationValue() {
    return getCookie("webfitt-calibration");
}

// 平均値
function computeMean(data) {
    if (data.length === 0) return NaN;
    var sum = 0;
    for (var i = 0; i < data.length; i++) {
        sum += data[i];
    }
    return sum / data.length;
}

// 標準偏差
function computeStandardDeviation(data) {
    if (data.length <= 1) return 0;
    var mean = computeMean(data);
    var sum = 0;
    for (var i = 0; i < data.length; i++) {
        sum += Math.pow(data[i] - mean, 2);
    }
    return Math.sqrt(sum / (data.length - 1));
}

// POSTリクエスト
function postRequest(url, data, callback) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (request.readyState == 4 && request.status == 200)
            callback(request.responseText);
    }
    request.open("POST", url, true);
    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    request.send(data);
}

// ZIPダウンロード
function saveAsZipFile(filename) {
    var zip = new JSZip();
    zip.file(filename + "_click.csv", generateClickResultString());
    zip.file(filename + "_task.csv", generateTaskResultString());
    zip.file(filename + "_overall.csv", generateMeanResultString());
    zip.generateAsync({ type: "blob" }).then(function (content) {
        saveAs(content, filename + ".zip"); // FileSaver.js利用
    });
}

// 配列が全て数値かどうか
function isArrayOfNumbers(array) {
    for (var i = 0; i < array.length; i++) {
        if (isNaN(array[i])) {
            return false;
        }
    }
    return true;
}

// 文字列配列→数値配列
function parseArrayOfNumbers(array) {
    var parsedArray = [];
    for (var i = 0; i < array.length; i++) {
        parsedArray.push(parseInt(array[i]));
    }
    return parsedArray;
}

// Cookie操作
function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}
