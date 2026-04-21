#!/bin/bash

# 修复HTML文件中的图片路径
for file in pages/*.html; do
    echo "修复文件: $file"
    # 替换图片路径
    sed -i '' 's|../static/assets/img/|../img/img/|g' "$file"
    # 修复导航链接中的路径
    sed -i '' 's|href="../static/|href="../pages/|g' "$file"
    sed -i '' 's|href="../pages/../pages/|href="../pages/|g' "$file"
done

echo "路径修复完成！"