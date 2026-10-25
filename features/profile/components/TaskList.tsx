'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui-shim'
import { CheckSquare, Plus, Trash2, Calendar } from 'lucide-react'
import { UserTask, upsertTask, deleteTask } from '../actions/profile-actions'

interface TaskListProps {
    tasks: UserTask[]
}

export function TaskList({ tasks }: TaskListProps) {
    const [isAdding, setIsAdding] = useState(false)
    const [newTaskTitle, setNewTaskTitle] = useState('')

    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) return
        await upsertTask({
            title: newTaskTitle,
            status: 'pending',
            priority: 'medium'
        })
        setNewTaskTitle('')
        setIsAdding(false)
    }

    const handleToggleStatus = async (task: UserTask) => {
        await upsertTask({
            ...task,
            status: task.status === 'completed' ? 'pending' : 'completed'
        })
    }

    const handleDelete = async (id: string) => {
        if (confirm('Delete this task?')) {
            await deleteTask(id)
        }
    }

    return (
        <Card className="h-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl overflow-hidden flex flex-col justify-between">
            <div>
                <CardHeader className="flex flex-row items-center justify-between p-5 md:p-6 border-b border-slate-100 dark:border-zinc-800">
                    <CardTitle className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        My Tasks
                    </CardTitle>
                    <Button size="sm" onClick={() => setIsAdding(!isAdding)} variant="outline" className="rounded-lg h-8 px-2.5 text-xs font-semibold">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
                    </Button>
                </CardHeader>
                <CardContent className="p-5 md:p-6">
                <div className="space-y-3">
                    {isAdding && (
                        <div className="flex gap-2 mb-4">
                            <Input
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="New task title..."
                                className="h-9"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                            />
                            <Button size="sm" onClick={handleAddTask}>Add</Button>
                        </div>
                    )}

                    {tasks.length === 0 && !isAdding ? (
                        <p className="text-gray-500 text-center py-4">No tasks yet</p>
                    ) : (
                        tasks.map((task) => (
                            <div key={task.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded group">
                                <input
                                    type="checkbox"
                                    checked={task.status === 'completed'}
                                    onChange={() => handleToggleStatus(task)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <div className="flex-1">
                                    <p className={`text-sm ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                                        {task.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${task.priority === 'high' ? 'bg-red-100 text-red-700' :
                                                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-green-100 text-green-700'
                                            }`}>
                                            {task.priority}
                                        </span>
                                        {task.due_date && (
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(task.due_date).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(task.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
            </div>
        </Card>
    )
}
