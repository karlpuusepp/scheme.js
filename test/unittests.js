/* parser tests */

module('parser - tokenize');

test('empty string should tokenize into null', function() {
  var t = tokenize('');
  deepEqual(t, null);
});

test('whitespace should tokenize into null', function() {
  var t = tokenize('   ');
  deepEqual(t, null);
});

test('tokenize should work with multiple whitespace characters', function() {
  deepEqual(tokenize('a  b    c'), ['a', 'b', 'c']);
});

test('tokenization should handle already existing whitespace', function() {
  var t = tokenize('( (test) ( test ))');
  deepEqual(t, ['(', '(', 'test', ')', '(', 'test', ')', ')']);
});

test('tokenize() should treat newline as space', function() {
  deepEqual(tokenize('(a (b) \n (c))'), ['(', 'a', '(', 'b', ')', '(','c',')',')']);
});

test('tokenizer should drop everything after ; symbol until newline', function() {
  deepEqual(tokenize('a ; this is ignored'), ['a']);
  deepEqual(tokenize('a;this is ignored'), ['a']);
  deepEqual(tokenize('a;nested;are;also;ignored'), ['a']);
  deepEqual(tokenize('a;cmnt\n'), ['a']);
  deepEqual(tokenize('a;newline;cancels;comment\nb;alsoAcomment'), ['a', 'b']);
  deepEqual(tokenize('a;cmnt\nb;cmnt2\nc;cmnt3'), ['a', 'b', 'c']);
});

module('parser - atom');

test('atom should evaluate integer', function() {
  strictEqual(atom('0'), 0);
  strictEqual(atom('15'), 15);
});

test('atom should evaluate float values', function() {
  strictEqual(atom('0.0'), 0.0);
  strictEqual(atom('15.4243'), 15.4243);
});

test('atom should evaluate #t and #f to booleans', function() {
  strictEqual(atom('#f'), false);
  strictEqual(atom('#F'), false);
  strictEqual(atom('#t'), true);
  strictEqual(atom('#T'), true);
});

test('atom should evaluate string literals to strings', function() {
  var testString = new StringLiteral('literal string');
  strictEqual(testString.strvalue, atom('"literal string"').strvalue);
});

module('parser - nested_repr');

test('nested_repr should construct recursive array from parentheses', function() {
  deepEqual(parse('(()())'), [[],[]]);
  deepEqual(parse('((()()(()))())'), [[[],[],[[]]], []]);
});

test('nested_repr should not parse past first pair of fully closed params', function() {
  deepEqual(parse('(())(this is ignored)'), [[]]);
});

test('parsing should throw SyntaxError on unexpected closing parentheses', function() {
  throws(function() {
    parse(')a (b c))');
  }, SyntaxError);
});

test('parsing should throw SyntaxError if parentheses are not closed', function() {
  throws(function() {
    parse("(a (b)");
  }, SyntaxError);
});



/* eval tests */

module('eval');

test('evaluate constant expressions', function() {
  strictEqual(_eval(['<', 2, 8]), true);
});

test('evaluate quote literal', function() {
  deepEqual(_eval(parse('(quote asdfg)')).strvalue, 'asdfg');
  deepEqual(_eval(parse('(quote (+ 15 15))')), ['+', 15, 15]);
  deepEqual(_eval(parse('(quote (1 3 5))')), [1, 3, 5]);
});

test('evaluate if statement', function() {
  strictEqual(_eval(parse('(if (< 5 5) (+ 2 5) (- 10 2))')), 8);
  strictEqual(_eval(parse('(if (= 5 5) (+ 2 5) (- 10 2))')), 7);
  throws(function() {
    _eval(parse('(if #t 2)'));
  }, SyntaxError);
});

test('evaluate cond statements', function() {
  strictEqual(_eval(parse('(cond (#f "false") (#t "true"))')).strvalue, "true");
  strictEqual(_eval(parse('(cond ((< 1 0) (+ 2 2)) (#f "false") (else "expected"))')).strvalue, "expected");
});

test('set! should change value in env', function() {
  var testenv = new Env();
  testenv['testval'] = 12;
  _eval(parse('(set! testval 5)'), testenv);
  strictEqual(testenv['testval'], 5);
});

test('define should add value to env', function() {
  var testenv = new Env();
  _eval(parse('(define testval 17.5)'), testenv);
  strictEqual(testenv['testval'], 17.5);
});

test('evaluate single argument lambdas', function() {
  strictEqual(_eval([['lambda', ['x'], ['+', 'x', 'x']], 8]), 16);
  strictEqual(_eval([['lambda', ['x'], ['+', 'x', 'x']], 8]), 16);
});

test('evaluate multi-argument lambdas', function() {
  strictEqual(_eval(parse('((lambda (x y) (* x y)) 2.1 5)')), 10.5);
  strictEqual(_eval(parse('((lambda (x y) (< x y)) 2 5)')), true);
});

test('let statement should not pollute existing env', function() {
  var testenv = new Env();
  testenv.insert(lisp_defaults);
  strictEqual(_eval(parse('(let ((a 5) (b 7)) (+ a b))'), testenv), 12);
  ok(testenv['a'] == undefined);
});

test('begin should return last evaluated expression', function() {
  strictEqual(_eval(parse('(begin 1 2 3 4 5)')), 5);
});

test('begin should retain predefined variables', function() {
  var result = _eval(['begin', ['define', 'r', 3], ['*', Math.PI, ['*', 'r', 'r']]]);
  equal(result, 28.274333882308138);
});

test('logical statements should evaluate', function() {
  strictEqual(_eval(parse('(and #f #t)')), false);
  strictEqual(_eval(parse('(or #f #t)')), true);
});

test('comparison should work on literals', function() {
  strictEqual(_eval(parse('(= "str" "str")')), true);
  strictEqual(_eval(parse('(= "str" "str1")')), false);
});

test('car and cdr should work with aliases', function() {
  strictEqual(_eval(parse('(car (list 1 2 3 4 5))')), 1);
  strictEqual(_eval(parse('(head (list 1 2 3 4 5))')), 1);
  deepEqual(_eval(parse('(cdr (list 1))')), []);
  deepEqual(_eval(parse('(cdr (list 1 2 3 4 5))')), [2,3,4,5]);
  deepEqual(_eval(parse('(tail (list 1 2 3 4 5))')), [2,3,4,5]);
});

test('map function should be parsed correctly', function() {
  strictEqual(_eval(parse('(null? (cdr (list 1)))')), true);
  deepEqual(_eval(parse('(map not (list #t #f #t))')), [false, true, false]);
});

/* env (state) tests */

module('env');

test('function definition and subsequent call should evaluate', function() {
  var testenv = new Env();
  testenv.insert(lisp_defaults);
  equal(_eval(['define', 'area', ['lambda', ['r'], ['*', 3.141592653, ['*', 'r', 'r']]]], testenv), undefined);
  equal(_eval(['area', 3], testenv), 28.274333877);
});
