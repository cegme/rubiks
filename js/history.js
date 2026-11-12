/**
 * A bounded undo stack. Snapshots are copied when they are pushed, so editing
 * the array afterward does not change what is stored. When the stack is full
 * the oldest snapshot is dropped.
 */
export function createHistory(limit = 100) {
  const stack = [];
  return {
    push(snapshot) {
      stack.push([...snapshot]);
      if (stack.length > limit) stack.shift();
    },
    /** Removes and returns the latest snapshot, or undefined when there is none. */
    pop() {
      return stack.pop();
    },
    get size() {
      return stack.length;
    },
  };
}
