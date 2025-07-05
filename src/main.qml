import QtQuick 2.15
import QtQuick.Window 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import QtGraphicalEffects 1.15

ApplicationWindow {
    id: window
    visible: true
    width: 400
    height: 600
    title: qsTr("登录")
    flags: Qt.Window | Qt.WindowCloseButtonHint
    
    // 背景渐变
    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#667eea" }
            GradientStop { position: 1.0; color: "#764ba2" }
        }
    }
    
    // 主要内容区域
    ColumnLayout {
        anchors.centerIn: parent
        width: Math.min(parent.width - 80, 300)
        spacing: 30
        
        // Logo区域
        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            width: 80
            height: 80
            radius: 40
            color: "#ffffff"
            opacity: 0.9
            
            Text {
                anchors.centerIn: parent
                text: "🔐"
                font.pixelSize: 32
            }
        }
        
        // 标题
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "欢迎登录"
            font.pixelSize: 28
            font.bold: true
            color: "#ffffff"
        }
        
        // 输入区域
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 20
            
            // 用户名输入框
            Rectangle {
                Layout.fillWidth: true
                height: 50
                radius: 25
                color: "#ffffff"
                opacity: 0.9
                
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 20
                    anchors.rightMargin: 20
                    spacing: 10
                    
                    Text {
                        text: "👤"
                        font.pixelSize: 16
                        color: "#666666"
                    }
                    
                    TextField {
                        id: usernameField
                        Layout.fillWidth: true
                        placeholderText: "用户名"
                        background: Rectangle { color: "transparent" }
                        font.pixelSize: 16
                        selectByMouse: true
                    }
                }
            }
            
            // 密码输入框
            Rectangle {
                Layout.fillWidth: true
                height: 50
                radius: 25
                color: "#ffffff"
                opacity: 0.9
                
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 20
                    anchors.rightMargin: 20
                    spacing: 10
                    
                    Text {
                        text: "🔒"
                        font.pixelSize: 16
                        color: "#666666"
                    }
                    
                    TextField {
                        id: passwordField
                        Layout.fillWidth: true
                        placeholderText: "密码"
                        echoMode: TextInput.Password
                        background: Rectangle { color: "transparent" }
                        font.pixelSize: 16
                        selectByMouse: true
                    }
                }
            }
        }
        
        // 记住密码选项
        RowLayout {
            Layout.fillWidth: true
            Layout.topMargin: 10
            
            CheckBox {
                id: rememberPassword
                text: "记住密码"
                font.pixelSize: 14
                
                indicator: Rectangle {
                    implicitWidth: 20
                    implicitHeight: 20
                    radius: 3
                    color: rememberPassword.checked ? "#4CAF50" : "#ffffff"
                    border.color: rememberPassword.checked ? "#4CAF50" : "#cccccc"
                    
                    Text {
                        anchors.centerIn: parent
                        text: "✓"
                        font.pixelSize: 12
                        color: "#ffffff"
                        visible: rememberPassword.checked
                    }
                }
                
                contentItem: Text {
                    text: rememberPassword.text
                    font: rememberPassword.font
                    opacity: enabled ? 1.0 : 0.3
                    color: "#ffffff"
                    verticalAlignment: Text.AlignVCenter
                    leftPadding: rememberPassword.indicator.width + rememberPassword.spacing
                }
            }
            
            Item { Layout.fillWidth: true }
            
            Text {
                text: "忘记密码？"
                font.pixelSize: 14
                color: "#ffffff"
                
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        console.log("忘记密码被点击")
                    }
                }
            }
        }
        
        // 登录按钮
        Button {
            id: loginButton
            Layout.fillWidth: true
            Layout.topMargin: 20
            height: 50
            text: "登录"
            font.pixelSize: 16
            font.bold: true
            
            background: Rectangle {
                radius: 25
                color: loginButton.pressed ? "#FFA726" : "#FF9800"
                border.width: 0
                
                // 添加阴影效果
                Rectangle {
                    anchors.fill: parent
                    anchors.topMargin: 2
                    radius: 25
                    color: "#000000"
                    opacity: 0.2
                    z: -1
                }
            }
            
            contentItem: Text {
                text: loginButton.text
                font: loginButton.font
                opacity: enabled ? 1.0 : 0.3
                color: "#ffffff"
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
            }
            
            onClicked: {
                if (usernameField.text === "" || passwordField.text === "") {
                    statusMessage.text = "请输入用户名和密码"
                    statusMessage.color = "#ff5722"
                } else {
                    statusMessage.text = "登录中..."
                    statusMessage.color = "#4CAF50"
                    // 这里可以添加实际的登录逻辑
                    console.log("尝试登录:", usernameField.text)
                }
            }
        }
        
        // 状态消息
        Text {
            id: statusMessage
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 10
            font.pixelSize: 14
            color: "#ffffff"
        }
        
        // 分割线
        Rectangle {
            Layout.fillWidth: true
            Layout.topMargin: 30
            height: 1
            color: "#ffffff"
            opacity: 0.3
        }
        
        // 注册链接
        Text {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 20
            text: "还没有账户？点击注册"
            font.pixelSize: 14
            color: "#ffffff"
            
            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                    console.log("注册被点击")
                    statusMessage.text = "跳转到注册页面..."
                    statusMessage.color = "#4CAF50"
                }
            }
        }
    }
    
    // 键盘事件处理
    Keys.onReturnPressed: loginButton.clicked()
    Keys.onEnterPressed: loginButton.clicked()
}
