package com.bookEatingBoogie.dreamGoblin.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.util.List;

@Getter
@Setter
@ToString
@NoArgsConstructor
@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(name = "userID", length = 50)
    private String userId;

    @ToString.Exclude
    @Column(name = "passwd", nullable = false, length = 100)
    private String password;

    @Column(name = "userName", nullable = false, length = 50)
    private String userName;

    //예전 가입 행에만 남아 있다. 새 가입은 전화번호를 받지 않는다.
    @Column(name = "phoneNum", length = 11)
    private String phoneNum;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Characters> characters;
}
