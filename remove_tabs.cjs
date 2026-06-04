const fs = require('fs');
const path = require('path');

const file = 'c:\\Users\\AJINKYA\\Desktop\\aria\\src\\pages\\WorkbenchPage.jsx';
let content = fs.readFileSync(file, 'utf-8');

// Change activeTab default
content = content.replace("useState('explorer')", "useState('memory')");

// Remove explorer tab button
content = content.replace(/<button\s+className={`workbench-tab \${activeTab === 'explorer' \? 'active' : ''}`}\s+onClick={\(\) => setActiveTab\('explorer'\)}\s+>\s+<Folder size={16} \/> File Explorer & Editor\s+<\/button>/, '');

// Remove terminal tab button
content = content.replace(/<button\s+className={`workbench-tab \${activeTab === 'terminal' \? 'active' : ''}`}\s+onClick={\(\) => setActiveTab\('terminal'\)}\s+>\s+<Terminal size={16} \/> Terminal\s+<\/button>/, '');

// Remove explorer panel
const explorerPanelRegex = /{\/\* 1\. FILE EXPLORER TAB \*\/}[\s\S]*?(?={\/\* 2\. AI MEMORY FACTS TAB \*\/})/;
content = content.replace(explorerPanelRegex, '');

// Remove terminal panel
const terminalPanelRegex = /{\/\* 6\. INTERACTIVE TERMINAL TAB \*\/}[\s\S]*?(?={\/\* --- CREATE FILE\/FOLDER MODAL --- \*\/})/;
content = content.replace(terminalPanelRegex, '');

fs.writeFileSync(file, content, 'utf-8');
console.log('Tabs and panels removed successfully.');
