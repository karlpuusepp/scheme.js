/* 
 * scheme.js, small Scheme interpreter in Javascript
 * Karl Puusepp, 2013
 */

/* Environment class holds Lisp variable context */
function Env(keys, values, outerEnv) {
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
    if (this._parent == undefined)
      throw new SyntaxError('undefined variable `'+variable+'`');
    return this._parent.find(variable);
}

/* insert key-value pair into environment */
Env.prototype.insert = function(keys) {
  for (var key in keys) {
    this[key] = keys[key];
  }
}

/* StringLiteral class encapsulates "string constants" */
function StringLiteral(strvalue) {
  this.strvalue = strvalue;
} 

/* essential functions defined as javascript */
var lisp_defaults = {
  '+': function(a, b) { return a + b; },
  '-': function(a, b) { return a - b; },
  '*': function(a, b) { return a * b; },
  '/': function(a, b) { return a / b; },
  '=': function(a, b) { 
    if (a instanceof StringLiteral || b instanceof StringLiteral)
      return a.strvalue === b.strvalue;
    else
      return a === b; 
  },
  '>': function(a, b) { return a > b; },
  '<': function(a, b) { return a < b; },
  'and': function(a, b) { return a && b; },
  'or': function(a, b) { return a || b; },
  'not': function(a) { return !a; },
  'length': function(a) { return a.length; },
  'list': function(a) { return Array.prototype.slice.call(arguments); },
  'car': function(a) { return a[0]; },
  'cdr': function(a) { return a.slice(1, a.length); },
  'cons': function(a, b) { return [a].concat(b); }
}

/* extra functions defined using the interpreter */
var lisp_extra = [
  '(define else #t)',
  '(define >= (lambda (x y) (not (< x y))))',
  '(define <= (lambda (x y) (not (> x y))))',
  '(define head car)',
  '(define tail cdr)',
  '(define null? (lambda (l) (= 0 (length l))))',
  '(define map (lambda (f l) (if (null? l) l (cons (f (car l)) (map f (cdr l))))))'
];

/* evaluation function, calculates the result of a given scheme representation */
var _eval = function(x, env) {
  env = env || global_env;

  if (typeof x === 'string') {        // variable, find it from the env
    return env.find(x)[x];

  } else if (!(x instanceof Array)) { // constant literal, return it
    return x;

  } else if (x[0] === 'quote') {      // (quote literal)
    if (x[1] == undefined)
      throw new SyntaxError('quote needs an argument');

    var literal = x[1];
    // check for list
    if (literal instanceof Array)
      return literal;
    else
      return new StringLiteral(lisp_string(literal));

  } else if (x[0] === 'if') {         // (if (test) (conseq) (alt))
    if (x[1] == undefined || x[2] == undefined || x[3] == undefined)
      throw new SyntaxError('if takes three arguments');

    var test = x[1];
    var conseq = x[2];
    var alt = x[3];
    return _eval((_eval(test, env) ? conseq : alt), env);

  } else if (x[0] === 'cond') {       // cond [(test conseq) ...]
    var retval;
    for (var i = 1; i < x.length; i++) {
      if (x[i][0] == undefined || x[i][1] == undefined) {
        throw new SyntaxError('wrong use of cond statement');
      }
      if (x[i][0] == 'else' && i != x.length - 1)
        throw new SyntaxError('unexpected `else` statement');
      if (_eval(x[i][0], env)) {
        retval = x[i][1];
        break;
      }
    }
    return retval;

  } else if (x[0] === 'set!') {       // (set! variable expression)
    if (x[1] == undefined || x[2] == undefined)
      throw new SyntaxError('set! takes two arguments');
    var variable = x[1];
    var expression = x[2];
    env.find(variable)[variable] = _eval(expression, env);

  } else if (x[0] === 'define') {     // (define variable expression)
    if (x[1] == undefined || x[2] == undefined)
      throw new SyntaxError('define takes two arguments');
    var variable = x[1];
    var expression = x[2];
    env[variable] = _eval(expression, env);

  } else if (x[0] === 'lambda') {     // (lambda (variables) (expression))
    if (x[1] == undefined || x[2] == undefined)
      throw new SyntaxError('lambda definition takes two arguments');
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

/* return value of a single token - string, int, bool, or float */
var atom = function(token) {
  var value = parseInt(token);
  if (value == NaN || isNaN(token)) {
    // check for boolean
    if (token == '#f' || token == '#F')
      return false;
    else if (token == '#t' || token == '#T')
      return true;
    // check if its a literal string
    if (/".*"/.test(token))
      return new StringLiteral(token.slice(1, -1));
    else
      return token; // return plain string to be evaluated later
  } else if (parseFloat(token) != value) {
    return parseFloat(token);
  } else {
    return value;
  }
}


/* error class used for user syntax errors */
function SyntaxError(message) {
  this.name = 'SyntaxError';
  this.message = message;
}

/* iterate recursively through tokens and evaluate/discard each */
var nested_repr = function(tokens) {
  if (tokens.length == 0) {
    throw new SyntaxError("unexpected EOL");
  }
  var tok = tokens.shift();
  if (tok == '(') {
    var l = [];
    while (tokens[0] != ')') {
      l.push(nested_repr(tokens));
    }
    tokens.shift(); // remove ')' from stack
    return l;
  } else if (tok == ')') {
    throw new SyntaxError('unexpected )');
  } else {
    return atom(tok);
  }
}

/* add padding to parentheses and split by whitespace */
var tokenize = function(s) {
  return s
    .replace(/([()])/g ,' $1 ') // add spacing for parentheses
    .replace(/;(.*)\n/g, ' ')   // replace anything between ; and \n with spaces
    .match(/[^;]*/g)[0]         // match resulting string until ;
    .match(/\S+/g);             // split string by whitespace
}

/* read a Scheme expression from string */
var parse = function(s) {
  return nested_repr(tokenize(s))
}

/* evaluate JS representations as Scheme syntax */
var lisp_string = function(tokens) {
  if (tokens instanceof Array)
    return '(' + tokens.map(lisp_string).join(' ') + ')';
  else if (tokens instanceof StringLiteral)
    return tokens.strvalue;
  else if (typeof(tokens) == 'function')
    return '#<function>';
  else if (typeof(tokens) == 'boolean')
    return tokens ? '#t' : '#f';
  else
    return ''+tokens;
}

/* set up global environment */
var global_env = new Env();
global_env.insert(lisp_defaults);
lisp_extra.map(function(def) {
  _eval(parse(def), global_env);
});

/* wrap all this in a single interface function */
var lsp = function(input) {
  try {
    var out = _eval(parse(input));
    return '=> ' + lisp_string(out);
  } catch (e) {
    if (e.name === 'TypeError')
      throw new SyntaxError('unknown input');
    if (e.name === 'SyntaxError')
      throw e;
  }
}
