import inquirer from 'inquirer';
import inquirerFuzzyPath from 'inquirer-fuzzy-path';
import ofx from 'ofx';
import fsExtra from 'fs-extra';

inquirer.registerPrompt('fuzzypath', inquirerFuzzyPath);

const loadFile = async (path: string) => {
  const file = await fsExtra.readFile(path);
  return String(file);
};

const parseOfx = async (ofxString) => {
  return ofx.parse(ofxString);
};

const loadOfx = async (path: string) => {
  const ofxFile = await loadFile(path);
  const ofx = await parseOfx(ofxFile);
  await fsExtra.writeFile(JSON.stringify(ofx, null, 2));
};
