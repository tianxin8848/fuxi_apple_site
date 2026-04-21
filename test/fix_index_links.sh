#!/bin/bash

# 修复 HTML 文件中的 /index 链接为 /

echo "正在修复 /index 链接..."

# 修复 pages 目录下的文件
for file in pages/*.html; do
    if [ -f "$file" ]; then
        echo "修复文件: $file"
        # 使用 sed 替换 /index 为 /
        sed -i '' 's|href="/index"|href="/"|g' "$file"
        sed -i '' 's|href="/index"|href="/"|g' "$file"
    fi
done

echo "修复完成！"
