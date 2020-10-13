/*
不要なアイテムを削除.jsx
Copyright (c) 2020 Toshiyuki Takahashi
Released under the MIT license
http://opensource.org/licenses/mit-license.php
http://www.graphicartsunit.com/
*/
(function () {
	// Preference
	var settings = {
		flagPathItem : true,
		flagPointText : true,
		flagAreaText : false,
		flagPathText : false,
		flagTransparent : false,
		flagHairline : false,
		notDelete : false,
		delLockObject : false,
		showAlert : true
	};

	// Constant
	const SCRIPT_TITLE = "不要なアイテムを削除";
	const SCRIPT_VERSION = "0.8.5";
	const HAIRLINE_ACCURACY = 2000;

	// Load setting from json file
	var saveOptions = {
		'os' : File.fs,
		'jsxPath' : $.fileName,
		'reverseDomain' : 'com.graphicartsunit',
		'fileName' : 'remove_needless_items.json',
		'path' : ''
	};
	saveOptions.path = getSettingFilePath(saveOptions);
	settings = loadSettings() ? loadSettings() : settings;

	// UI Dialog
	function mainDialog() {
		this.init();
		return this;
	};
	mainDialog.prototype.init = function() {

		var unit = 20;
		var thisObj = this;

		thisObj.dlg = new Window("dialog", SCRIPT_TITLE + " - ver." + SCRIPT_VERSION);
		thisObj.dlg.margins = [unit*1.5, unit*1.5, unit*1.5, unit*1.5];

		thisObj.checkBoxes = {};

		thisObj.settingPanel = thisObj.dlg.add("panel", undefined, "削除の対象：");
		thisObj.settingPanel.alignment = "left";
		thisObj.settingPanel.margins = [unit, unit, unit, unit];
		thisObj.settingPanel.orientation = "column";

		thisObj.checkBoxes.flagPathItem = thisObj.settingPanel.add("checkbox", undefined, "孤立点");
		thisObj.checkBoxes.flagPointText = thisObj.settingPanel.add("checkbox", undefined, "文字のないポイント文字");
		thisObj.checkBoxes.flagAreaText = thisObj.settingPanel.add("checkbox", undefined, "文字のないエリア内文字");
		thisObj.checkBoxes.flagPathText = thisObj.settingPanel.add("checkbox", undefined, "文字のないパス上文字");
		thisObj.checkBoxes.flagTransparent = thisObj.settingPanel.add("checkbox", undefined, "不透明度0％のオブジェクト");
		thisObj.checkBoxes.flagHairline = thisObj.settingPanel.add("checkbox", undefined, "ヘアラインパス");

		thisObj.optionGroup = thisObj.dlg.add("group", undefined);
		thisObj.optionGroup.alignment = "left";
		thisObj.optionGroup.margins = [unit*0, unit/2, unit*0, unit/2];
		thisObj.optionGroup.orientation = "column";

		thisObj.checkBoxes.notDelete = thisObj.optionGroup.add("checkbox", undefined, "削除せずに選択する");
		thisObj.checkBoxes.delLockObject = thisObj.optionGroup.add("checkbox", undefined, "ロック、非表示オブジェクトも対象にする");
		thisObj.checkBoxes.showAlert = thisObj.optionGroup.add("checkbox", undefined, "実行後に報告メッセージを表示する");

		for (var key in thisObj.checkBoxes) {
			thisObj.checkBoxes[key].name = key;
			thisObj.checkBoxes[key].value = settings[key];
			thisObj.checkBoxes[key].alignment = "left";
			thisObj.checkBoxes[key].onClick = function(e) {
				settings[this.name] = this.value;
			}
		}

		thisObj.buttonGroup = thisObj.dlg.add("group", undefined);
		thisObj.buttonGroup.margins = [unit, unit*0, unit, unit*0];
		thisObj.buttonGroup.alignment = "center";
		thisObj.buttonGroup.orientation = "row";
		thisObj.cancel = thisObj.buttonGroup.add("button", undefined, "キャンセル", {name: "cancel"});
		thisObj.ok = thisObj.buttonGroup.add("button", undefined, "実行", { name:"ok"});

		thisObj.ok.onClick = function() {
			if (settings.delLockObject && settings.notDelete) {
				var stemsAmount = confirm("今の設定では、以下のロックと非表示が解除されます。続けますか？\n・対象オブジェクトすべて\n・対象オブジェクトが存在するレイヤー");
				if (!stemsAmount) return;
			}
			try {
				deleteItems();
			} catch(e) {
				alert("以下のエラーが発生しましたので処理を中止します\n" + e);
			} finally {
				saveSettings();
				thisObj.closeDialog();
			}
		}
		thisObj.cancel.onClick = function() {
			thisObj.closeDialog();
		}

	};
	mainDialog.prototype.showDialog = function() {
		this.dlg.show();
	};
	mainDialog.prototype.closeDialog = function() {
		this.dlg.close();
	};
	var dialog = new mainDialog();
	dialog.showDialog();

	// Main Process
	function deleteItems() {

		// Get layers and items
		var layers = app.activeDocument.layers;
		var foundSymbol = false;
		var targetItems = getTargetItems(app.activeDocument.pageItems);

		// Deselect all items
		if(settings.notDelete) {
			for (var i = 0; i < layers.length; i++) {
				layers[i].hasSelectedArtwork = false;
			}
		}

		// Remove or select target items
		var counters = {};
		for (var i = targetItems.length - 1; i >= 0; i--) {

			var targetItem = targetItems[i].item;

			// Count target item
			if(counters[targetItems[i].kind]) {
				counters[targetItems[i].kind]++;
			} else {
				counters[targetItems[i].kind] = 1;
			}

			// Get current layer propaties
			var currentLayer = {
				'layer' : targetItem.layer,
				'locked' : targetItem.layer.locked,
				'visible' : targetItem.layer.visible
			};

			// Unlock and show layer
			if (currentLayer.layer.locked || !currentLayer.layer.visible) {
				currentLayer.layer.locked = false;
				currentLayer.layer.visible = true;
			}

			// Remove or select target item
			if(settings.notDelete) {
				targetItem.locked = false;
				targetItem.hidden = false;
				targetItem.selected = true;
			} else {
				targetItem.remove();
				currentLayer.layer.locked = currentLayer.locked;
				currentLayer.layer.visible = currentLayer.visible;
			}
		}

		// Show report
		alert(getReportStrings(counters));

	}

	// Get Target Items
	function getTargetItems(items) {
		var targetItems = [];
		for (var i = 0; i < items.length; i++) {
			if (items[i].typename == 'PathItem' || items[i].typename == 'TextFrame') {
				var props = getTargetProps(items[i]);
				if(props) targetItems.push(props);
			}
		}
		return targetItems;
	}

	// Get target
	function getTargetProps(item) {

		var itemProps = new TargetItemProp(item);

		if (item.opacity <= 0 && settings.flagTransparent) {
			itemProps.isTarget = true;
			itemProps.kind = 'zeroOpacity';

		// Case of text item
		} else if (item.typename === 'TextFrame') {
			if (item.contents.length < 1) {

				// Point text
				if (item.kind === TextType.POINTTEXT && settings.flagPointText) {
					itemProps.isTarget = true;
					itemProps.kind = 'pointText';
				}
				// Area text
				if (item.kind === TextType.AREATEXT && settings.flagAreaText) {
					if ((!item.textPath.stroked && !item.textPath.filled) || (settings.flagHairline && isHairlinePath(item.textPath))) {
						itemProps.isTarget = true;
						itemProps.kind = 'areaText';
					}
				}
				// Path text
				if (item.kind === TextType.PATHTEXT && settings.flagPathText) {
					if ((!item.textPath.stroked && !item.textPath.filled) || (settings.flagHairline && isHairlinePath(item.textPath))) {
						itemProps.isTarget = true;
						itemProps.kind = 'pathText';
					}
				}
			}

		// Case of path item
		} else if (item.typename == 'PathItem') {
			if (item.pathPoints.length < 2 && item.length <= 0 && settings.flagPathItem) {
				itemProps.isTarget = true;
				itemProps.kind = 'pathItem';
			} else if (item.pathPoints.length > 1 && settings.flagHairline && isHairlinePath(item)) {
				itemProps.isTarget = true;
				itemProps.kind = 'hairlinePath';
			}

		// Case of symbol item
		} else if (item.typename == 'SymbolItem') {
			foundSymbol = true;
		}

		// Return propaties;
		return itemProps.isTarget ? itemProps : undefined;
	}

	function TargetItemProp(item) {
		var prop = {
			'item': item,
			'typename': item.typename,
			'kind': '',
			'isTarget': false
		}
		return prop;
	}

	// Get hairline path
	function isHairlinePath(item) {
		var b = true;
		if (!item.filled || item.stroked || !isAllStraght(item) || item.pathPoints.length < 2) {
			b = false;
		} else {
			var allAngle = getAllAngle(item.pathPoints);
			if (allAngle.length > 1) {
				var baseAngle = allAngle[0];
				var allowableAngle = 360 / HAIRLINE_ACCURACY;
				for (var i = 1; i < allAngle.length; i++) {
					if (Math.abs(baseAngle - allAngle[i]) >= allowableAngle) {
						b = false;
					}
				}
			}
		}
		return b;

		function getAllAngle(points) {
			var allAngle = [];
			var basePoint, nextPoint, angle;
			for (var i = 0; i < points.length - 1; i++) {
				basePoint = {x:item.pathPoints[i].anchor[0], y:item.pathPoints[i].anchor[1]};
				nextPoint = {x:item.pathPoints[i + 1].anchor[0], y:item.pathPoints[i + 1].anchor[1]};
				if (!(basePoint.x == nextPoint.x && basePoint.y == nextPoint.y)) {
					angle = (Math.atan2(nextPoint.y - basePoint.y, nextPoint.x - basePoint.x)) * 180 / Math.PI;
					if (angle < 0) {
						angle += 180;
					}
					allAngle.push(angle);
				}
			}
			return allAngle;
		}

		function isAllStraght(item) {
			for (var i = 0; i < item.pathPoints.length; i++) {
				if (hasDirection(item.pathPoints[i])) {
					return false;
					break;
				}
			}
			return true;
		}

		function hasDirection(point) {
			var posX = [point.anchor[0], point.leftDirection[0], point.rightDirection[0]];
			var posY = [point.anchor[1], point.leftDirection[1], point.rightDirection[1]];
			var objX = {max:Math.max.apply(null, posX), min:Math.min.apply(null, posX)};
			var objY = {max:Math.max.apply(null, posY), min:Math.min.apply(null, posY)};
			if (objX.max == objX.min && objY.max == objY.min) {
				return false;
			}
			return true;
		}

	}

	// Show Message
	function getReportStrings(counters) {
		var str_obj = {
			'pathItem': '孤立点',
			'pointText': '文字のないポイント文字',
			'areaText': '文字のないエリア内文字',
			'pathText': '文字のないパス上文字',
			'zeroOpacity': '不透明度0％のオブジェクト',
			'hairlinePath': 'ヘアラインパス',
		}

		var total = 0;
		for (var key in counters) {
			total += Number(counters[key]);
		}

		var messasge = '';
		if(total > 0) {
			messasge += '合計 ' + total + ' 点のアイテムを';
			messasge += settings.notDelete ? '選択' : '削除';
			messasge += 'しました';
			for (var key in counters) {
				messasge += '\n・' + str_obj[key] + ' : ' + counters[key];
			}
		} else {
			messasge = '対象のアイテムがありませんでした';
		}

		return messasge;
	}

	// Get path of json file
	function getSettingFilePath(options) {
		var filepath = '';
		switch(options.os) {
			case 'Macintosh':
				filepath = Folder.userData + '/' + options.reverseDomain + '/Illustrator/Scripts/' + options.fileName;
				break;
			case 'Windows':
				filepath = Folder.userData + '/' + options.reverseDomain + '/Illustrator/Scripts' + options.fileName;
				break;
			default :
				break;
		}
		return filepath;
	}

	// Load settings from json file
	function loadSettings() {
		if(new File(saveOptions.path).exists) {
			var settingFile = new File(saveOptions.path);
			settingFile.encoding = 'UTF-8';
			settingFile.open('r');
			var loadedSettings = settingFile.readln();
			loadedSettings = (new Function('return' + loadedSettings))();
			settingFile.close();
			return loadedSettings;
		} else {
			return false;
		}
	}

	// Save settings to json file
	function saveSettings() {
		var dir = saveOptions.path.match(/(.*)(\/)/)[1];
		if(!new Folder(dir).exists) {
			new Folder(dir).create();
		}
		var settingFile = new File(saveOptions.path);
		settingFile.open('w');
		settingFile.write(settings.toSource());
		settingFile.close();
	}

}());