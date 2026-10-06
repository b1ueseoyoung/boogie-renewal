package com.bookEatingBoogie.dreamGoblin.controller;

import com.bookEatingBoogie.dreamGoblin.model.User;
import com.bookEatingBoogie.dreamGoblin.service.LoginService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "http://localhost:3100")
public class LoginController {

    @Autowired
    private LoginService loginService;

    @PostMapping("/login")
    public ResponseEntity login(@RequestBody User user){

        System.out.println("userId = {" + user.getUserId() + "}, password = {" + user.getPassword() + "}");

        if(loginService.login(user).equals("Success")) {
            return new ResponseEntity(HttpStatus.CREATED);
        }
        return new ResponseEntity(HttpStatus.BAD_REQUEST);
    }


    @PostMapping("/signup")
    public ResponseEntity signup(@RequestBody User user) {
        System.out.println("userId = {" + user.getUserId() + "}, password = {" + user.getPassword() + "}, userName = {" + user.getUserName() + "}, phoneNumber = {" + user.getPhoneNum() + "}");
        if(loginService.signup(user).equals("Success")) {
            return new ResponseEntity(HttpStatus.CREATED);
        }
        return new ResponseEntity(HttpStatus.BAD_REQUEST);
    }

}
