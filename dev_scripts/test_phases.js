global.window = {};
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
const phases = [
  {
    setup: `
      window.attackerIP = \`\${rnd(11,250)}.\${rnd(0,255)}.\${rnd(0,255)}.\${rnd(1,254)}\`;
      vfs['/']['var']['log']['auth.log'] = \`Oct 7 10:15:22 sshd[1410]: Accepted publickey\\nOct 7 10:18:22 sshd[1422]: Failed password for root from \${window.attackerIP} port 45192\\nOct 7 10:18:24 sshd[1424]: Failed password for root from \${window.attackerIP} port 45194\`;
      return \`Broadcast message from ossec@sys-server (tty1) \${getBroadcastTime()}:\\n\\nOSSEC HIDS Alert: Multiple failed SSH login attempts detected.\\nAction required: Block the attacking IP.\`;
    `
  }
];

const phasesJson = JSON.stringify(phases);
const parsed = JSON.parse(phasesJson).map(p => ({
    setup: new Function('vfs', 'rnd', 'getBroadcastTime', p.setup),
}));

let vfs = { '/': { 'var': { 'log': {} }, 'etc': {}, 'home': {} } };
parsed[0].setup(vfs, rnd, () => 'now');

console.log(JSON.stringify(vfs['/']['var']['log']['auth.log']));
