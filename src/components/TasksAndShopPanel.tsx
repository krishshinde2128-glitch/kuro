import { useState } from 'react';
import { Plus, Check, Trash2, ShoppingBag } from 'lucide-react';
import { SHOP_ITEMS } from '../game/petState';
import type { FocusTask, ShopItem } from '../game/petState';

interface TasksAndShopPanelProps {
  petName: string;
  tasks: FocusTask[];
  walletBalance: number;
  roomInventory: string[];
  onAddTask: (title: string) => void;
  onCompleteTask: (task: FocusTask) => void;
  onDeleteTask: (taskId: string) => void;
  onBuyItem: (item: ShopItem) => void;
  onOpenPlay: () => void;
}

export function TasksAndShopPanel({
  petName,
  tasks,
  walletBalance,
  roomInventory,
  onAddTask,
  onCompleteTask,
  onDeleteTask,
  onBuyItem,
  onOpenPlay,
}: TasksAndShopPanelProps) {
  const [taskTitle, setTaskTitle] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = taskTitle.trim();
    if (!trimmed) return;
    onAddTask(trimmed);
    setTaskTitle('');
  };

  return (
    <section
      aria-label="Focus queue and room shop"
      className="bg-white border border-zinc-200 rounded-2xl flex flex-col h-[540px] lg:h-[600px] overflow-hidden shadow-sm"
    >
      <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Focus Queue & Room Shop</h2>
          <p className="text-xs text-zinc-500">
            Complete tasks (+10 coins) to feed {petName} and furnish your room
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-amber-700 font-medium whitespace-nowrap shrink-0">
          {walletBalance} coins
        </span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-zinc-200">
        {/* Focus Task Queue */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-700">Today’s Tasks</h3>
            <span className="text-xs text-zinc-500 tabular-nums">
              {tasks.filter((t) => t.completed).length}/{tasks.length} done
            </span>
          </div>

          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <label htmlFor="new-task-input" className="sr-only">
              Add a real-life focus task
            </label>
            <input
              id="new-task-input"
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Add a concrete task (e.g., Draft lab report intro)"
              className="flex-1 min-h-[42px] px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={taskTitle.trim().length === 0}
              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </form>

          {tasks.length === 0 ? (
            <div className="py-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-500">
                No tasks queued right now. Add one above or feed {petName} in Treat Catch!
              </p>
              <button
                type="button"
                onClick={onOpenPlay}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Play Treat Catch
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200/80">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      disabled={task.completed}
                      onClick={() => onCompleteTask(task)}
                      aria-label={
                        task.completed
                          ? `Completed "${task.title}"`
                          : `Complete "${task.title}"`
                      }
                      className={`min-h-[36px] min-w-[36px] rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                        task.completed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-zinc-300 text-transparent hover:border-blue-600 hover:text-blue-600 cursor-pointer'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <span
                      className={`text-sm truncate ${
                        task.completed ? 'line-through text-zinc-400' : 'text-zinc-900'
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    aria-label={`Delete "${task.title}"`}
                    className="min-h-[36px] min-w-[36px] rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Room Furniture Shop */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-zinc-500" />
              <span>Room Furniture Shop</span>
            </h3>
            <span className="text-xs text-zinc-500">Or say &ldquo;Buy [Item]&rdquo; in chat</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHOP_ITEMS.map((item) => {
              const owned = roomInventory.some(
                (name) => name.toLowerCase() === item.name.toLowerCase()
              );
              const missingPrereq =
                Boolean(item.requiresItem) &&
                !roomInventory.some(
                  (name) => name.toLowerCase() === item.requiresItem!.toLowerCase()
                );
              const affordable = walletBalance >= item.cost;

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-zinc-50 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-sm font-semibold text-zinc-900">{item.name}</h4>
                      <span className="text-xs font-mono tabular-nums font-medium text-amber-700 shrink-0">
                        {item.cost}c
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={owned || missingPrereq || !affordable}
                    onClick={() => onBuyItem(item)}
                    className="min-h-[38px] w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {owned
                      ? 'In Room'
                      : missingPrereq
                        ? `Requires ${item.requiresItem}`
                        : affordable
                          ? `Buy ${item.name} (${item.cost}c)`
                          : `Need ${item.cost - walletBalance} More Coins`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
