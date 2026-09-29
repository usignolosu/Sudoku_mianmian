#!/usr/bin/env bash
# Codex 沙盒无外网，手动推送脚本
set -e
cd "$(dirname "$0")"

echo "=== 当前 commit ==="
git log --oneline -3

echo ""
echo "=== 检查远端 ==="
git remote -v

echo ""
echo "=== 推送到 GitHub (origin) ==="
read -p "确认推送到 https://github.com/usignolosu/Sudoku_mianmian.git ? [y/N] " yn
case "$yn" in
  [Yy]* )
    git push origin master
    echo "✓ GitHub 推送完成"
    ;;
  * )
    echo "跳过 GitHub"
    ;;
esac

echo ""
echo "=== 同步到 Gitee（备份，可选）==="
read -p "是否同步到 Gitee (git@gitee.com:usignolosu/sodoku.git) ? [y/N] " yn
case "$yn" in
  [Yy]* )
    git push gitee master
    echo "✓ Gitee 推送完成"
    ;;
  * )
    echo "跳过 Gitee"
    ;;
esac

echo ""
echo "✓ 全部完成"
