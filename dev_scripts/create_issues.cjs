const fs = require('fs');
const { execSync } = require('child_process');

const coursesFile = '../src/data/courses.json';
const coursesData = JSON.parse(fs.readFileSync(coursesFile, 'utf-8'));

console.log('Starting issue creation...');

for (const course of coursesData) {
    const className = course.name;
    
    for (const lesson of course.lessons) {
        const title = `Урок ${lesson.id}: ${lesson.topic} (${className})`;
        const body = `### Задача для ИИ-агента\n\nНеобходимо разработать контент и тренажеры для данного урока.\n\n**Класс:** ${className}\n**Урок:** ${lesson.id}\n**Тема:** ${lesson.topic}\n\n#### Чек-лист:\n- [ ] Написать теорию (\`theory.md\`)\n- [ ] Разработать Уровень 1 (Базовый)\n- [ ] Разработать Уровень 2 (Продвинутый)\n- [ ] Разработать Уровень 3 (Хардкор/Аркада)\n\n*См. \`AGENTS.md\` и \`docs/ai-workflow.md\` перед началом работы.*`;
        
        console.log(`Creating issue: ${title}`);
        try {
            // Use execSync to run gh CLI with absolute path since PATH might not be reloaded yet
            execSync(`"C:\\Program Files\\GitHub CLI\\gh.exe" issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --label "content,enhancement"`, { stdio: 'inherit' });
            
            // Wait 2 seconds to respect GitHub API limits
            execSync('powershell -command "Start-Sleep -Seconds 2"');
        } catch (e) {
            console.error(`Failed to create issue: ${title}`);
            console.error(e.message);
            process.exit(1);
        }
    }
}
console.log('All issues created successfully!');
