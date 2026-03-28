---
name: "code-quality-check"
description: "在提交代码前必须执行的质量门禁检查流程，包含自动化脏代码扫描脚本和人工审查清单"
---

# 🛡️ 代码质量门禁 (Code Quality Gate)

在执行任何 `git add` 和 `git commit` **之前**，必须先完成本技能所要求的全部质量检查流程。
不通过检查的代码 **严禁** 提交。

## 流程概览

```
代码修改完毕 → 执行脚本扫描 → 阅读清单自查 → 清理问题 → 才能提交
```

## Step 1: 执行自动化扫描脚本

在当前技能目录下有一个脚本文件：`scripts/check-dirty-code.sh`

你必须使用 `execute_command` 工具运行该脚本：
```bash
bash .agents/skills/code-quality-check/scripts/check-dirty-code.sh
```

- 如果脚本输出了警告项（即检测到 `console.log`、`debugger`、`TODO`、`FIXME` 等残留），你 **必须先清理这些问题**，然后重新运行脚本直到通过。
- 如果脚本报告 "✅ 检查通过"，则进入 Step 2。

## Step 2: 对照审查清单自查

使用 `read_file` 工具阅读本技能目录下的资源文件：
```
.agents/skills/code-quality-check/resources/checklist.md
```

逐条对照清单内容进行自检。如有不符合项，先修复再继续。

## Step 3: 全部通过后，才能提交

确认 Step 1 脚本无警告 + Step 2 清单全部通过后，方可执行 `git add` 和 `git commit`。
