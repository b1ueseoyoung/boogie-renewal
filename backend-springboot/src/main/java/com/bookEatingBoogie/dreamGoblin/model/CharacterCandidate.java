package com.bookEatingBoogie.dreamGoblin.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "character_candidate")
public class CharacterCandidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "candidateID")
    private int candidateId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "charID", nullable = false)
    private Characters characters;

    @Column(name = "imgUrl", nullable = false, length = 512)
    private String imgUrl;

    @ColumnDefault("false")
    @Column(name = "approved", nullable = false)
    private boolean approved;

    @CreationTimestamp
    @Column(name = "createdAt")
    private LocalDateTime createdAt;
}
