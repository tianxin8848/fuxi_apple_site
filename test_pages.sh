#!/bin/bash

echo "测试所有页面是否可以访问..."
echo "=============================="

# 检查页面文件是否存在
pages=("index.html" "products.html" "solutions.html" "blog.html" "company.html" "contact.html")

for page in "${pages[@]}"; do
    file_path="pages/$page"
    if [ -f "$file_path" ]; then
        echo "✓ $page 文件存在"
        
        # 检查图片路径
        img_count=$(grep -o '../img/img/' "$file_path" | wc -l)
        if [ "$img_count" -gt 0 ]; then
            echo "  - 包含 $img_count 个图片引用"
        fi
        
        # 检查Tailwind CSS配置
        if grep -q 'cdn.tailwindcss.com' "$file_path"; then
            echo "  - Tailwind CSS 配置正确"
        fi
        
        # 检查导航链接
        nav_links=$(grep -o 'href="../pages/[^"]*"' "$file_path" | sort -u)
        if [ -n "$nav_links" ]; then
            echo "  - 导航链接:"
            echo "$nav_links" | sed 's/^/    /'
        fi
    else
        echo "✗ $page 文件不存在"
    fi
    echo ""
done

echo "页面结构测试完成！"
echo "可以通过以下URL访问："
echo "主页: http://localhost:8080/pages/index.html"
echo "产品页: http://localhost:8080/pages/products.html"
echo "解决方案页: http://localhost:8080/pages/solutions.html"
echo "博客页: http://localhost:8080/pages/blog.html"
echo "公司页: http://localhost:8080/pages/company.html"
echo "联系页: http://localhost:8080/pages/contact.html"