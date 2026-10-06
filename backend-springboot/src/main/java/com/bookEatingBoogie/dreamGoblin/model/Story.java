package com.bookEatingBoogie.dreamGoblin.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDate;
import java.time.LocalDateTime;
import com.aventrix.jnanoid.jnanoid.NanoIdUtils;
import org.hibernate.annotations.CreationTimestamp;

import java.time.format.DateTimeFormatter;

@Getter
@Setter
@ToString
@NoArgsConstructor
@Entity
@Table(name = "story")
public class Story {

    @Id
    @Column(name = "storyID", columnDefinition = "VARCHAR(36)")
    private String storyId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creationID", nullable = false)
    private Creation creation;

    @Column(name = "title", length = 100)
    private String title;

    @CreationTimestamp
    @Column(name = "creationDate", nullable = false, updatable = false)
    private LocalDateTime creationDate;

    @Column(name = "favorite")
    private boolean favorite = false;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "coverImg")
    private String coverImg;

    @Column(name = "content")
    private String content;


    public static String newId() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        // 길이를 4로 지정해 4글자 ID 생성
        String randPart = NanoIdUtils.randomNanoId(NanoIdUtils.DEFAULT_NUMBER_GENERATOR, NanoIdUtils.DEFAULT_ALPHABET, 4).toUpperCase();
        return datePart + randPart;
    }

    @PrePersist
    public void generateId() {
        if (this.storyId == null) {
            this.storyId = newId();
        }
    }
}
