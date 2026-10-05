import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',timeout:90000,workers:1,retries:0,
  use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1100,height:800},trace:'retain-on-failure',screenshot:'only-on-failure',
    launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:[
    {command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',timeout:30000,reuseExistingServer:false},
    {command:'npm run server:dev',url:'http://127.0.0.1:8080',timeout:30000,reuseExistingServer:false,env:{ALLOWED_ORIGINS:'http://127.0.0.1:4173'}}
  ]
});
