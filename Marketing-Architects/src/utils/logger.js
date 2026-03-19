import chalk from 'chalk';

let verboseEnabled = false;

export function setVerbose(enabled) {
  verboseEnabled = enabled;
}

export function info(msg) {
  console.log(chalk.blue('ℹ'), msg);
}

export function success(msg) {
  console.log(chalk.green('✔'), msg);
}

export function warn(msg) {
  console.log(chalk.yellow('⚠'), msg);
}

export function error(msg) {
  console.log(chalk.red('✖'), msg);
}

export function verbose(msg) {
  if (verboseEnabled) {
    console.log(chalk.gray('  ·'), msg);
  }
}

export function table(data) {
  console.table(data);
}

export function summary(title, rows) {
  console.log('');
  console.log(chalk.bold.underline(title));
  for (const [label, value] of Object.entries(rows)) {
    console.log(`  ${chalk.gray(label + ':')} ${value}`);
  }
  console.log('');
}
