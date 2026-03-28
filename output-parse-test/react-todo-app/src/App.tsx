import { useState, useEffect } from 'react'
import './App.css'

interface Todo {
  id: number
  text: string
  completed: boolean
  createdAt: number
}

type FilterType = 'all' | 'active' | 'completed'

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('todos')
    return saved ? JSON.parse(saved) : []
  })
  const [inputValue, setInputValue] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  // 添加 todo
  const addTodo = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      const newTodo: Todo = {
        id: Date.now(),
        text: inputValue.trim(),
        completed: false,
        createdAt: Date.now()
      }
      setTodos([newTodo, ...todos])
      setInputValue('')
    }
  }

  // 删除 todo
  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  // 切换完成状态
  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  // 开始编辑
  const startEdit = (id: number, text: string) => {
    setEditingId(id)
    setEditingText(text)
  }

  // 保存编辑
  const saveEdit = (id: number) => {
    if (editingText.trim()) {
      setTodos(todos.map(todo =>
        todo.id === id ? { ...todo, text: editingText.trim() } : todo
      ))
    }
    setEditingId(null)
    setEditingText('')
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setEditingText('')
  }

  // 筛选 todos
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  // 统计信息
  const stats = {
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length
  }

  return (
    <div className="app">
      <div className="container">
        <h1 className="title">📝 Todo List</h1>

        {/* 统计信息 */}
        <div className="stats">
          <div className="stat-item">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">全部</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.active}</span>
            <span className="stat-label">进行中</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.completed}</span>
            <span className="stat-label">已完成</span>
          </div>
        </div>

        {/* 添加表单 */}
        <form className="add-form" onSubmit={addTodo}>
          <input
            type="text"
            className="add-input"
            placeholder="添加新的待办事项..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit" className="add-button">
            添加
          </button>
        </form>

        {/* 筛选按钮 */}
        <div className="filters">
          <button
            className={`filter-button ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部
          </button>
          <button
            className={`filter-button ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            进行中
          </button>
          <button
            className={`filter-button ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            已完成
          </button>
        </div>

        {/* Todo 列表 */}
        <ul className="todo-list">
          {filteredTodos.map(todo => (
            <li
              key={todo.id}
              className={`todo-item ${todo.completed ? 'completed' : ''}`}
            >
              <input
                type="checkbox"
                className="todo-checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
              />
              {editingId === todo.id ? (
                <div className="edit-container">
                  <input
                    type="text"
                    className="edit-input"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="save-button"
                    onClick={() => saveEdit(todo.id)}
                  >
                    保存
                  </button>
                  <button
                    className="cancel-button"
                    onClick={cancelEdit}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <>
                  <span className="todo-text">{todo.text}</span>
                  <div className="todo-actions">
                    <button
                      className="edit-button"
                      onClick={() => startEdit(todo.id, todo.text)}
                    >
                      编辑
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => deleteTodo(todo.id)}
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {filteredTodos.length === 0 && (
          <div className="empty-state">
            <p>暂无待办事项</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
