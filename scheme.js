/* 
 * scheme.js, small Scheme interpreter in Javascript
 * Karl Puusepp, 2013
 */

/* Environment class holds Lisp variable context */
var Env = function(keys, values, outerEnv) {
  if (keys && values) {
    for (var i = 0; i < keys.length; i++) {
      this[keys[i]] = values[i];
    }
  }
  this._parent = outerEnv || undefined;
}

/* return the innermost Env where `variable` appears */
Env.prototype.find = function(variable) {
  if (this[variable])
    return this;
  else
    return this._parent.find(variable);
}

/* insert key-value pair into environment */
Env.prototype.insert = function(keys) {
  for (var key in keys) {
    this[key] = keys[key];
  }
}

/* essential functions */
var defaults = {
  '+': function(a, b) { return a + b; },
  '-': function(a, b) { return a - b; },
  '*': function(a, b) { return a * b; },
  '/': function(a, b) { return a / b; },
  '=': function(a, b) { return a == b; },
  '>': function(a, b) { return a > b; },
  '<': function(a, b) { return a < b; },
  'not': function(a) { return !a; },
  'length': function(a) { return a.length; },
  'car': function(a) { return a[0]; },
  'cdr': function(a) { return a.slice(1, a.length); }
}

var global_env = new Env();
global_env.insert(defaults);


var _eval = function(x, env) {
  env = env || global_env;

  if (typeof x === 'string') {        // variable, find it from the env
    return env.find(x)[x];
  } else if (!(x instanceof Array)) { // constant literal, return it
    return x;
  } else if (x[0] === 'quote') {      // (quote exp)
    var exp = x[1];
    return exp;
  } else if (x[0] === 'if') {         // (if test conseq alt)
    var test = x[1];
    var conseq = x[2];
    var alt = x[3];
    return _eval((_eval(test, env) ? conseq : alt), env);
  } else if (x[0] === 'set!') {       // (set! variable expression)
    var variable = x[1];
    var expression = x[2];
    env.find(variable)[variable] = _eval(exp, env);
  } else if (x[0] === 'define') {     // (define variable expression)
    var variable = x[1];
    var expression = x[2];
    env[variable] = _eval(expression, env);
  } else if (x[0] === 'lambda') {     // (lambda (variables) (expression))
    var variables = x[1]
    var expression = x[2];
    return function() { return _eval(expression, new Env(variables, arguments, env)); };
  } else if (x[0] === 'begin') {      // (begin [expressions])
    var retval;
    for (var i = 1; i < x.length; i++) {
      retval = _eval(x[i], env);
    }
    return retval;
  } else {                            // (proc [expressions])
    var expressions = x.map(function(e) { return _eval(e, env); });
    var proc = expressions.shift();
    var res = proc.apply(null, expressions);
    return res;
  }
}

/* return value of a single token - string, int or float */
var atom = function(token) {
  var value = parseInt(token);
  if (value == NaN || isNaN(token)) {
    return token; // return it as string if number parsing failed
  } else if (parseFloat(token) != value) {
    return parseFloat(token);
  } else {
    return value;
  }
}

/* iterate recursively through tokens and evaluate/discard each */
var read_from = function(tokens) {
  if (tokens.length == 0) {
    throw "unexpected end of tokens";
  }
  var tok = tokens.shift();
  if (tok == '(') {
    var l = [];
    while (tokens[0] != ')') {
      l.push(read_from(tokens));
    }
    tokens.shift(); // remove ')' from stack
    return l;
  } else if (tok == ')') {
    throw 'unexpected )';
  } else {
    return atom(tok);
  }
}

/* add padding to parentheses and split by whitespace */
var tokenize = function(s) {
  return s.replace(/([()])/g ,' $1 ').match(/\S+/g);
}

/* read a Scheme expression from string */
var parse = function(s) {
  return read_from(tokenize(s))
}

/* print result in Scheme */
var lisp_string = function(tokens) {
  if (tokens instanceof Array)
    return '(' + tokens.map(lisp_string).join(' ') + ')';
  else
    return ''+tokens;
      
}

/* epl without the r */
var lsp = function(input) {
    var out = _eval(parse(input));
    console.log('=> '+out);
}

// ---------- testcases -------------

//console.log(_eval(['*', 3, 3]));
//console.log(_eval(['begin', ['define', 'r', 3], ['*', Math.PI, ['*', 'r', 'r']]]));
//var program = '(begin (define r 3) (* 3.141592653 (* r r)))';
var program2 = '(define area (lambda (r) (* 3.141592653 (* r r))))'
lsp(program2);
lsp('(area 3)');
