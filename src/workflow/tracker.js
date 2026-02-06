/**
 * Progress Tracker Module
 * Tracks workflow execution progress and provides real-time updates
 */

const EventEmitter = require('events');
const { logger } = require('../utils/logger');

class ProgressTracker extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
    this.milestones = new Map();
    this.startTime = null;
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTime: 0,
    };
  }

  /**
   * Initialize tracking for a workflow
   * @param {string} workflowId - Unique workflow identifier
   * @param {Array} tasks - List of tasks to track
   */
  initWorkflow(workflowId, tasks) {
    this.workflowId = workflowId;
    this.startTime = Date.now();
    this.metrics.totalTasks = tasks.length;

    tasks.forEach((task, index) => {
      this.tasks.set(task.id || `task_${index}`, {
        ...task,
        status: 'pending',
        progress: 0,
        startTime: null,
        endTime: null,
        attempts: 0,
      });
    });

    logger.info('Workflow tracking initialized', {
      workflowId,
      totalTasks: tasks.length
    });

    this.emit('workflow:initialized', {
      workflowId,
      totalTasks: tasks.length,
      startTime: this.startTime,
    });
  }

  /**
   * Update task progress
   * @param {string} taskId - Task identifier
   * @param {object} update - Progress update
   */
  updateProgress(taskId, update) {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn('Task not found for progress update', { taskId });
      return;
    }

    // Update task properties
    Object.assign(task, update);

    // Handle status changes
    if (update.status) {
      this.handleStatusChange(taskId, update.status, task);
    }

    // Emit progress event
    this.emit('task:progress', {
      taskId,
      task: { ...task },
      overall: this.getOverallProgress(),
    });

    logger.debug('Task progress updated', { taskId, ...update });
  }

  /**
   * Handle task status changes
   */
  handleStatusChange(taskId, status, task) {
    const now = Date.now();

    switch (status) {
      case 'running':
        task.startTime = now;
        task.attempts++;
        this.emit('task:started', { taskId, task });
        break;

      case 'completed':
        task.endTime = now;
        task.duration = now - task.startTime;
        task.progress = 100;
        this.metrics.completedTasks++;
        this.updateAverageTime();
        this.emit('task:completed', { taskId, task });
        this.checkMilestones();
        break;

      case 'failed':
        task.endTime = now;
        task.duration = now - task.startTime;
        this.metrics.failedTasks++;
        this.emit('task:failed', { taskId, task });
        break;

      case 'retrying':
        this.emit('task:retrying', {
          taskId,
          attempt: task.attempts,
          task
        });
        break;
    }
  }

  /**
   * Set a milestone
   * @param {string} name - Milestone name
   * @param {number} threshold - Completion percentage to trigger
   */
  setMilestone(name, threshold) {
    this.milestones.set(name, {
      threshold,
      reached: false,
      reachedAt: null,
    });

    logger.info('Milestone set', { name, threshold });
  }

  /**
   * Check and trigger milestones
   */
  checkMilestones() {
    const progress = this.getOverallProgress();

    this.milestones.forEach((milestone, name) => {
      if (!milestone.reached && progress.percentage >= milestone.threshold) {
        milestone.reached = true;
        milestone.reachedAt = Date.now();

        logger.info('Milestone reached', {
          name,
          threshold: milestone.threshold,
          progress: progress.percentage
        });

        this.emit('milestone:reached', {
          name,
          milestone,
          progress
        });
      }
    });
  }

  /**
   * Get overall workflow progress
   */
  getOverallProgress() {
    const tasks = Array.from(this.tasks.values());
    const totalProgress = tasks.reduce((sum, task) => sum + (task.progress || 0), 0);
    const percentage = tasks.length > 0 ? (totalProgress / (tasks.length * 100)) * 100 : 0;

    const completed = tasks.filter(t => t.status === 'completed').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const running = tasks.filter(t => t.status === 'running').length;
    const pending = tasks.filter(t => t.status === 'pending').length;

    return {
      percentage: Math.round(percentage),
      completed,
      failed,
      running,
      pending,
      total: tasks.length,
      elapsed: this.startTime ? Date.now() - this.startTime : 0,
      estimatedRemaining: this.estimateRemainingTime(),
    };
  }

  /**
   * Estimate remaining time
   */
  estimateRemainingTime() {
    if (this.metrics.completedTasks === 0) return null;

    const averageTime = this.metrics.averageTime;
    const remaining = this.metrics.totalTasks - this.metrics.completedTasks;

    return Math.round(averageTime * remaining);
  }

  /**
   * Update average task completion time
   */
  updateAverageTime() {
    const completedTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'completed' && t.duration);

    if (completedTasks.length === 0) return;

    const totalTime = completedTasks.reduce((sum, t) => sum + t.duration, 0);
    this.metrics.averageTime = totalTime / completedTasks.length;
  }

  /**
   * Get detailed task report
   */
  getTaskReport(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      ...task,
      timeline: this.getTaskTimeline(taskId),
      performance: this.getTaskPerformance(taskId),
    };
  }

  /**
   * Get task execution timeline
   */
  getTaskTimeline(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return [];

    const timeline = [];

    if (task.startTime) {
      timeline.push({
        event: 'started',
        timestamp: task.startTime,
        attempt: task.attempts,
      });
    }

    if (task.endTime) {
      timeline.push({
        event: task.status === 'completed' ? 'completed' : 'failed',
        timestamp: task.endTime,
        duration: task.duration,
      });
    }

    return timeline;
  }

  /**
   * Get task performance metrics
   */
  getTaskPerformance(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || !task.duration) return null;

    return {
      duration: task.duration,
      attempts: task.attempts,
      efficiency: task.attempts === 1 ? 100 : Math.round(100 / task.attempts),
      relativeSpeed: this.metrics.averageTime > 0
        ? Math.round((this.metrics.averageTime / task.duration) * 100)
        : null,
    };
  }

  /**
   * Get workflow summary
   */
  getSummary() {
    const progress = this.getOverallProgress();
    const duration = this.startTime ? Date.now() - this.startTime : 0;

    return {
      workflowId: this.workflowId,
      status: this.determineWorkflowStatus(),
      progress,
      metrics: this.metrics,
      duration,
      startTime: this.startTime,
      milestones: Array.from(this.milestones.entries()).map(([name, data]) => ({
        name,
        ...data,
      })),
      performance: {
        successRate: this.metrics.totalTasks > 0
          ? (this.metrics.completedTasks / this.metrics.totalTasks) * 100
          : 0,
        averageTaskTime: Math.round(this.metrics.averageTime),
        throughput: duration > 0
          ? (this.metrics.completedTasks / (duration / 1000 / 60)).toFixed(2)
          : 0,
      },
    };
  }

  /**
   * Determine overall workflow status
   */
  determineWorkflowStatus() {
    const tasks = Array.from(this.tasks.values());

    if (tasks.every(t => t.status === 'completed')) return 'completed';
    if (tasks.some(t => t.status === 'running')) return 'running';
    if (tasks.every(t => ['completed', 'failed'].includes(t.status))) return 'finished';
    if (tasks.every(t => t.status === 'pending')) return 'pending';

    return 'in_progress';
  }

  /**
   * Export tracking data
   */
  exportData() {
    return {
      workflowId: this.workflowId,
      startTime: this.startTime,
      tasks: Array.from(this.tasks.entries()).map(([id, task]) => ({
        id,
        ...task,
      })),
      milestones: Array.from(this.milestones.entries()).map(([name, data]) => ({
        name,
        ...data,
      })),
      metrics: this.metrics,
      summary: this.getSummary(),
    };
  }

  /**
   * Reset tracker
   */
  reset() {
    this.tasks.clear();
    this.milestones.clear();
    this.startTime = null;
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTime: 0,
    };

    logger.info('Progress tracker reset');
    this.emit('tracker:reset');
  }
}

module.exports = { ProgressTracker };