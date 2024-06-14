// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

const { promisify } = require('util');
const fs = require('fs');
const readFileSync = promisify(fs.readFileSync);
const path = require('path');
const axios = require('axios');


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	/*VSCode API*/
	const button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
	button.command = 'local-llm-request.analyzeCode';
	button.text = 'Text Generation API';
	context.subscriptions.push(button);
	button.show();


	/*
	LLM呼び出し
	コードの変更をもとに
	コード修正案
	*/
	const disposable = vscode.commands.registerCommand('local-llm-request.analyzeCode', async () => {

		const activeTextEditor = await vscode.window.activeTextEditor;

		if (activeTextEditor) {
			// アクティブなテキストエディタのファイルURIを取得
			const fileUri = activeTextEditor.document.uri;
			const filePath = fileUri.fsPath;
			// ファイルの拡張子を取得
            const ext = path.extname(filePath);
			console.log('Get Active Text Editor File');


			try {
				// ファイル名とディレクトリパスを設定
				const fileName = `Patched_Code${ext}`; // あらかじめ決めたファイル名
				const currentFilePath = vscode.window.activeTextEditor.document.fileName;
				const directoryPath = path.dirname(currentFilePath);
				let filePath_w = path.join(directoryPath, fileName);


				vscode.window.showInformationMessage('コード修正' );

				vscode.window.showInformationMessage('API Requesting...');	
				console.log('API Request');

				//LLM呼び出し
				const res = await api_request(filePath, 1);

				// ファイルを作成して書き込み
				fs.writeFileSync(filePath_w, res);
				

				// エディタにファイルを表示
				const patched_Document = await vscode.workspace.openTextDocument(filePath_w);

				await vscode.window.showTextDocument(patched_Document);
				//Diff
				getDiff_uri(filePath, filePath_w);

			} catch (error) {
				console.error('Error:', error.message);
				vscode.window.showErrorMessage('An error occurred while creating the file.');
			}

		} else {
			console.error('アクティブなテキストエディタがありません。');
		}

	});


	/*
	ドキュメント保存
	LLMへコード学習
	*/
    const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
		const activeTextEditor = await vscode.window.activeTextEditor;

		if (activeTextEditor) {
			try{
				// アクティブなテキストエディタのファイルURIを取得
				const fileUri = activeTextEditor.document.uri;
				const filePath = fileUri.fsPath;

				vscode.window.showInformationMessage('コード学習' );

				const res = await api_request(filePath, 0);


				/*
				res解析
				console出力
				*/

			} catch (error) {
				console.error('Error:', error.message);
				vscode.window.showErrorMessage('An error occurred while creating the file.');
			}

		} else {
			console.error('アクティブなテキストエディタがありません。');
		}
	});



	//オブジェクトを subscriptions に追加
	context.subscriptions.push(disposable);
	context.subscriptions.push(onSaveDisposable);
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}





/*Add function*/

function getDiff_uri(file1, file2) {
	const uri1 = vscode.Uri.file(path.resolve(file1));
	const uri2 = vscode.Uri.file(path.resolve(file2));

	vscode.commands.executeCommand('vscode.diff', uri1, uri2);
}

async function api_request(filePath, mode) {

	const endpoint = '/v1/completions';
	let prompt = '';

	/*コードの文字列化*/
	let code_a = readFileAndStore(filePath);

	//質問文
	const url = `http://192.168.10.30:5000${endpoint}`;

	if(mode === 0){
		/*学習プロンプト*/
		prompt = `#Order\n
		Send the code as "#Code_A" and output it as "#Response". Learn to change the code. Output '200' if the code has been learned. If it fails to learn, output '400' and a comment after the newline code.\n
		\n
		#Code_A\n
		${code_a}\n
		#Response\n`;

	}else if(mode === 1){
		/*コード修正プロンプト*/
		prompt = `#Order\n
		Apply exception handling to "#Code A" and output it as "#Code B". Do not output text in the output result, only the program code\n
		\n
		#Code A\n
		${code_a}\n
		#Code B\n`;
	}

	const payload = {
		'prompt': prompt,
		'max_tokens': 1024,
		'temperature': 0.7,
		'temperature_last': false,
		'dynamic_temperature': false,
		'dynatemp_low': 1,
		'dynatemp_high': 1,
		'dynatemp_exponent': 1,
		'smoothing_factor': 0,
		'top_p': 0.9,
		'min_p': 0,
		'top_k': 20,
		'repetition_penalty': 1.15,
		'presence_penalty': 0,
		'frequency_penalty': 0,
		'repetition_penalty_range': 1024,
		'typical_p': 1,
		'tfs': 1,
		'top_a': 0,
		'epsilon_cutoff': 0,
		'eta_cutoff': 0,
		'guidance_scale': 1,
		'penalty_alpha': 0,
		'mirostat_mode': 0,
		'mirostat_tau': 5,
		'mirostat_eta': 0.1,
		'do_sample': true,
		'seed': -1,
		'encoder_repetition_penalty': 1,
		'no_repeat_ngram_size': 0,
		'min_length': 0,
		'num_beams': 1,
		'length_penalty': 1,
		'early_stopping': false,
		'sampler_priority': 'temperature\ndynamic_temperature\nquadratic_sampling\ntop_k\ntop_p\ntypical_p\nepsilon_cutoff\neta_cutoff\ntfs\ntop_a\nmin_p\nmirostat'
	};

	const config = {
		headers: {
			'Content-Type': 'application/json'
		}
	};

	try {
		// @ts-ignore
		const response = await axios.post(url, payload, config);

		if(response.status === 200){
			// 情報メッセージを表示する場合
			vscode.window.showInformationMessage('Status :' + JSON.stringify(response.status))
			vscode.window.showInformationMessage('Finish Reason :' + JSON.stringify(response.data.choices[0].finish_reason));
		}else{
			// エラーメッセージを表示する場合
			vscode.window.showErrorMessage('Status :' + JSON.stringify(response.status))
		}

		console.log(response);
		console.log(response.data.choices[0].text);


		return response.data.choices[0].text;

	} catch (error) {
		console.error(error);
		// Handle error as needed
	}
}


function readFileAndStore(filePath) {
	try {
		// ファイルを同期的に読み込む
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		// ファイル内の文字列を変数に格納
		const storedString = fileContent;
		// 変数に格納された文字列を出力
		return storedString;

	} catch (error) {
		console.error('ファイルの読み込みエラー:', error);
	}
}
