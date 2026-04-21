#!/bin/bash

echo "测试无后缀URL访问..."
echo "========================"
echo "服务器运行在: http://localhost:8080"
echo ""

# 测试URL列表
test_urls=(
  "/"
  "/products"
  "/solutions"
  "/blog"
  "/company"
  "/contact"
)

# 检查服务器是否运行
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ > /dev/null 2>&1; then
  echo "错误: 开发服务器未运行或无法访问"
  echo "请先运行: npm start"
  exit 1
fi

echo "测试无后缀URL:"
echo "--------------"

for url in "${test_urls[@]}"; do
  full_url="http://localhost:8080${url}"
  status_code=$(curl -s -o /dev/null -w "%{http_code}" "$full_url")

  if [ "$status_code" = "200" ]; then
    echo "✓ $url (HTTP $status_code)"

    # 检查页面标题
    title=$(curl -s "$full_url" | grep -o '<title>[^<]*</title>' | sed 's/<title>//;s/<\/title>//')
    if [ -n "$title" ]; then
      echo "  标题: $title"
    fi

    # 检查导航链接
    nav_count=$(curl -s "$full_url" | grep -o 'href="[^"]*"' | grep -v '\.html' | grep -E 'href="/(products|solutions|blog|company|contact|)"' | wc -l)
    if [ "$nav_count" -gt 0 ]; then
      echo "  包含 $nav_count 个无后缀导航链接"
    fi

  elif [ "$status_code" = "404" ]; then
    echo "✗ $url (HTTP 404 - 页面未找到)"
  else
    echo "? $url (HTTP $status_code)"
  fi
  echo ""
done

echo "测试完成！"
echo ""
echo "现在可以通过以下简洁的URL访问："
echo "--------------------------------"
echo "主页:        http://localhost:8080/"
echo "产品页:      http://localhost:8080/products"
echo "解决方案页:  http://localhost:8080/solutions"
echo "博客页:      http://localhost:8080/blog"
echo "公司页:      http://localhost:8080/company"
echo "联系页:      http://localhost:8080/contact"
echo ""
echo "旧的带.html后缀的URL仍然可以工作，但会重定向到无后缀版本。"