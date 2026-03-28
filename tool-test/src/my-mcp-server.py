#!/usr/bin/env python3
"""
Python 版本的 MCP Server
与 my-mcp-server.mjs 功能完全相同，验证 MCP 跨语言能力
"""

from mcp.server.fastmcp import FastMCP

# 创建 MCP Server 实例
mcp = FastMCP("my-mcp-server")

# 模拟数据库
DATABASE = {
    "users": {
        "001": {
            "id": "001",
            "name": "张三",
            "email": "zhangsan@example.com",
            "role": "admin",
        },
        "002": {
            "id": "002",
            "name": "李四",
            "email": "lisi@example.com",
            "role": "user",
        },
        "003": {
            "id": "003",
            "name": "王五",
            "email": "wangwu@example.com",
            "role": "user",
        },
    }
}


@mcp.tool()
def query_user(userId: str) -> str:
    """
    查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。

    Args:
        userId: 用户 ID，例如: 001, 002, 003

    Returns:
        用户详细信息的字符串
    """
    user = DATABASE["users"].get(userId)

    if not user:
        return f"用户 ID {userId} 不存在。可用的 ID: 001, 002, 003"

    return f"""用户信息：
- ID: {user['id']}
- 姓名: {user['name']}
- 邮箱: {user['email']}
- 角色: {user['role']}"""


@mcp.resource("docs://guide")
def get_guide() -> str:
    """
    MCP Server 使用文档
    """
    return """MCP Server 使用指南
功能：提供用户查询等工具。
使用：在 Cursor 等 MCP Client 中通过自然语言对话，Cursor 会自动调用相应工具。"""


if __name__ == "__main__":
    # 启动服务器，使用 stdio 传输
    mcp.run()
