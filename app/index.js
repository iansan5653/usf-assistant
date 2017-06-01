// app/index.js
const calc = require('./calc');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var numbersToAdd = [];
rl.question('Enter the first number:', function(first) {
	numbersToAdd.push(first)
	rl.close();
	rl.question('Enter the second number:', function(second) {
		numbersToAdd.push(second)
		console.log(numbersToAdd)  
		const result = calc.sum(numbersToAdd)  
		console.log(result)  
		rl.close();
	})
})


