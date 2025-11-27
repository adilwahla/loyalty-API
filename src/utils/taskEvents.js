// utils/taskEvents.js
function emitTaskCreated(io, task) {
  if (!io || !task) return;
  
  // Emit to assigned user
  if (task.userId) {
    io.to(`user:${task.userId}`).emit('task_created', {
      task: task,
      message: 'New task assigned to you'
    });
    console.log(`📋 [SOCKET] task_created emitted to user:${task.userId}`);
  }
  
  // Emit to admin room
  io.to('admin_tasks').emit('task_created', {
    task: task,
    message: 'Task created successfully'
  });
  console.log('📋 [SOCKET] task_created emitted to admin_tasks');
}

function emitTaskUpdated(io, task) {
  if (!io || !task) return;
  
  // Emit to admin room
  io.to('admin_tasks').emit('task_updated', {
    task: task,
    message: 'Task updated'
  });
  console.log('📋 [SOCKET] task_updated emitted to admin_tasks');
  
  // Emit to assigned user
  if (task.userId) {
    io.to(`user:${task.userId}`).emit('task_updated', {
      task: task,
      message: 'Your task has been updated'
    });
    console.log(`📋 [SOCKET] task_updated emitted to user:${task.userId}`);
  }
}

function emitTaskCompleted(io, task) {
  if (!io || !task) return;
  
  // Emit to admin room with completion details
  io.to('admin_tasks').emit('task_completed', {
    task: task,
    message: `Task "${task.taskTitle || 'Untitled'}" has been completed`,
    nextVisitDate: task.dateVisit || null,
    comment: task.comment || null
  });
  console.log('📋 [SOCKET] task_completed emitted to admin_tasks');
  
  // Also notify the user
  if (task.userId) {
    io.to(`user:${task.userId}`).emit('task_completed', {
      task: task,
      message: 'Task marked as completed'
    });
    console.log(`📋 [SOCKET] task_completed emitted to user:${task.userId}`);
  }
}

function emitTaskAssigned(io, task, oldUserId = null) {
  if (!io || !task) return;
  
  // Notify old user if task was reassigned
  if (oldUserId && oldUserId !== task.userId) {
    io.to(`user:${oldUserId}`).emit('task_assigned', {
      task: task,
      message: 'Task has been reassigned'
    });
    console.log(`📋 [SOCKET] task_assigned (reassigned) emitted to user:${oldUserId}`);
  }
  
  // Notify new user
  if (task.userId) {
    io.to(`user:${task.userId}`).emit('task_assigned', {
      task: task,
      message: 'New task assigned to you'
    });
    console.log(`📋 [SOCKET] task_assigned emitted to user:${task.userId}`);
  }
  
  // Notify admin
  io.to('admin_tasks').emit('task_assigned', {
    task: task,
    message: 'Task assignment updated'
  });
  console.log('📋 [SOCKET] task_assigned emitted to admin_tasks');
}

module.exports = { 
  emitTaskCreated, 
  emitTaskUpdated, 
  emitTaskCompleted, 
  emitTaskAssigned 
};

