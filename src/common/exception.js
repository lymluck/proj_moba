// 错误类
export default class Exception {
  constructor(type, message) {
    this.type = type;
    this.message = message;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, Exception);
      this.stack = this.stack.split('\n');
      this.stack[0] = ['Error', this.type, this.message].join(' ');
      this.stack = this.stack.join('\n');
    }
  }
}
