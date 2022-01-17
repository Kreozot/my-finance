import inquirer from 'inquirer';
import inquirerFuzzyPath from 'inquirer-fuzzy-path';
import ofx from 'ofx';
import fsExtra from 'fs-extra';

inquirer.registerPrompt('fuzzypath', inquirerFuzzyPath);

const loadFile = async (path: string) => {
  const file = await fsExtra.readFile(path);
  return String(file);
};

const parseOfx = async (ofxString: string) => {
  return ofx.parse(ofxString);
};

const loadOfx = async (path: string) => {
  const ofxFile = await loadFile(path);
  const ofx = await parseOfx(ofxFile);
  await fsExtra.ensureDir('out');
  await fsExtra.writeFile('out/out.json', JSON.stringify(ofx, null, 2));
};

loadOfx('./data/operations Sat Jan 01 13_28_08 MSK 2022-Mon Jan 17 10_35_44 MSK 2022.ofx');
