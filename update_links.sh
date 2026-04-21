#!/bin/bash

echo "更新HTML文件中的链接，去掉.html后缀..."
echo "=========================================="

# 页面列表
pages=("index" "products" "solutions" "blog" "company" "contact")

for page in "${pages[@]}"; do
    file="pages/${page}.html"
    if [ -f "$file" ]; then
        echo "处理文件: $file"

        # 1. 更新导航链接中的.html后缀
        sed -i '' "s|href=\"../pages/${page}.html\"|href=\"/${page}\"|g" "$file"
        sed -i '' "s|href=\"/pages/${page}.html\"|href=\"/${page}\"|g" "$file"

        # 2. 更新所有页面间的链接
        for target_page in "${pages[@]}"; do
            if [ "$target_page" != "$page" ]; then
                sed -i '' "s|href=\"../pages/${target_page}.html\"|href=\"/${target_page}\"|g" "$file"
            fi
        done

        # 3. 更新首页链接
        sed -i '' "s|href=\"../pages/index.html\"|href=\"/\"|g" "$file"
        sed -i '' "s|href=\"#\"|href=\"/\"|g" "$file"

        # 4. 更新当前页面高亮（去掉.html比较）
        sed -i '' "s|href=\"/${page}\" class=\"text-sm font-medium text-cyber-red\"|href=\"/${page}\" class=\"text-sm font-medium text-cyber-red\"|g" "$file"

        echo "  ✓ 完成"
    else
        echo "  ✗ 文件不存在: $file"
    fi
done

echo ""
echo "链接更新完成！"
echo "新的URL结构："
echo "- 主页: /"
echo "- 产品页: /products"
echo "- 解决方案页: /solutions"
echo "- 博客页: /blog"
echo "- 公司页: /company"
echo "- 联系页: /contact"
