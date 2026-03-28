#!/bin/bash
# ============================================================
# 🔍 脏代码自动扫描器 (Dirty Code Scanner)
# 扫描 Git 暂存区中的文件，检测残留的调试代码和待办标记
# ============================================================

echo "🔍 正在扫描暂存区文件中的脏代码..."
echo "================================================"

# 获取暂存区中的文件列表（只看已修改/新增的代码文件）
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|mjs|ts|tsx|jsx|vue|py|go|java|css|html)$')

if [ -z "$STAGED_FILES" ]; then
    echo "📭 暂存区没有代码文件，跳过检查。"
    exit 0
fi

FOUND_ISSUES=0

# 检查项 1: console.log / console.debug / console.warn (非 console.error)
echo ""
echo "📋 检查项 1: 残留的 console.log / console.debug ..."
CONSOLE_HITS=$(echo "$STAGED_FILES" | xargs grep -n 'console\.\(log\|debug\|warn\|info\)' 2>/dev/null || true)
if [ -n "$CONSOLE_HITS" ]; then
    echo "⚠️  发现以下残留的 console 输出："
    echo "$CONSOLE_HITS"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
    echo "   ✅ 通过"
fi

# 检查项 2: debugger 语句
echo ""
echo "📋 检查项 2: debugger 断点语句 ..."
DEBUGGER_HITS=$(echo "$STAGED_FILES" | xargs grep -n 'debugger' 2>/dev/null || true)
if [ -n "$DEBUGGER_HITS" ]; then
    echo "⚠️  发现以下 debugger 断点："
    echo "$DEBUGGER_HITS"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
    echo "   ✅ 通过"
fi

# 检查项 3: TODO / FIXME / HACK 标记
echo ""
echo "📋 检查项 3: 未处理的 TODO / FIXME / HACK ..."
TODO_HITS=$(echo "$STAGED_FILES" | xargs grep -n '\(TODO\|FIXME\|HACK\|XXX\)' 2>/dev/null || true)
if [ -n "$TODO_HITS" ]; then
    echo "⚠️  发现以下待办/临时标记："
    echo "$TODO_HITS"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
    echo "   ✅ 通过"
fi

# 检查项 4: 硬编码的敏感信息（密码、token、secret）
echo ""
echo "📋 检查项 4: 疑似硬编码的敏感信息 ..."
SECRET_HITS=$(echo "$STAGED_FILES" | xargs grep -inE '(password|secret|token|api_key|apikey)\s*[:=]' 2>/dev/null || true)
if [ -n "$SECRET_HITS" ]; then
    echo "🚨 发现疑似硬编码的敏感信息："
    echo "$SECRET_HITS"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
    echo "   ✅ 通过"
fi

# 汇总
echo ""
echo "================================================"
if [ $FOUND_ISSUES -gt 0 ]; then
    echo "❌ 扫描完毕：发现 $FOUND_ISSUES 类问题，请清理后重新提交！"
    exit 1
else
    echo "✅ 扫描完毕：所有检查项全部通过，代码质量达标！"
    exit 0
fi
