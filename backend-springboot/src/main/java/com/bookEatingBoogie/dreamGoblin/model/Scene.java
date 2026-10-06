package com.bookEatingBoogie.dreamGoblin.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "scene", uniqueConstraints = @UniqueConstraint(columnNames = {"creationID", "page"}))
public class Scene {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sceneID")
    private int sceneId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creationID", nullable = false)
    private Creation creation;

    @Column(name = "page", nullable = false)
    private int page;

    @Column(name = "choice")
    private String choice;

    @Column(name = "story", columnDefinition = "TEXT")
    private String story;

    @Column(name = "question", columnDefinition = "TEXT")
    private String question;

    @Column(name = "choices", columnDefinition = "TEXT")
    private String choices;

    @Column(name = "illustUrl", length = 512)
    private String illustUrl;

    @Column(name = "illustPrompt", columnDefinition = "TEXT")
    private String illustPrompt;

    @CreationTimestamp
    @Column(name = "createdAt")
    private LocalDateTime createdAt;
}
