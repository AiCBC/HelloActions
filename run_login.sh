#!/bin/bash

# 启动登录界面应用
echo "启动登录界面应用..."
echo "注意：此应用需要图形界面环境"
echo ""

# 切换到项目目录
cd /workspace

# 运行应用
./bin/release/HelloActions-Qt

echo ""
echo "应用已关闭"