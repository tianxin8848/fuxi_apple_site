#!/bin/bash

# 修复 HTML 文件中的图片路径
# 将 ../img/img/ 替换为 ../img/

echo "正在修复图片路径..."

# 修复 pages 目录下的文件
for file in pages/*.html; do
    if [ -f "$file" ]; then
        echo "修复文件: $file"
        # 使用 sed 替换 ../img/img/ 为 ../img/
        sed -i '' 's|\.\./img/img/|\.\./img/|g' "$file"
    fi
done

echo "修复完成！"