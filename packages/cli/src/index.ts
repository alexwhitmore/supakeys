import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('supakeys')
  .description('CLI for setting up passkey authentication with Supabase')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize passkey authentication in your Supabase project')
  .option('-d, --dir <directory>', 'Supabase directory', './supabase')
  .option('--skip-migration', 'Skip database migration setup')
  .option('--skip-function', 'Skip edge function setup')
  .option('--dry-run', 'Show what would be created without writing files')
  .action(initCommand);

program.parse();

if (!process.argv.slice(2).length) {
  console.log(
    chalk.cyan(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ${chalk.bold('supakeys')}                                               ║
║   ${chalk.dim('Passkey authentication for Supabase')}                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`)
  );
  program.help();
}
