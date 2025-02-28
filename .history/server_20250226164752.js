require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

console.log("🚀 서버 실행 준비 중...");

// MySQL 연결 설정
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "hjsoo2001!",  // 본인 MySQL 비밀번호 입력
    database: "myblog"
});

// MySQL 연결 확인
db.connect((err) => {
    if (err) {
        console.error("❌ MySQL 연결 실패:", err);
    } else {
        console.log("✅ MySQL 연결 성공!");
    }
});

// 서버 실행
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});

//회원가입
app.post("/api/register", async (req, res) => {
    const { username, email, password, profile_image, bio } = req.body;

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // MySQL에 저장
    db.query(
        "INSERT INTO users (username, email, password, profile_image, bio) VALUES (?, ?, ?, ?, ?)",
        [username, email, hashedPassword, profile_image, bio],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: "회원가입 실패" });
            }
            res.status(201).json({ message: "회원가입 성공!" });
        }
    );
});

//로그인
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: "이메일 또는 비밀번호가 틀립니다." });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "이메일 또는 비밀번호가 틀립니다." });
        }

        // ✅ JWT 토큰 생성 (원래 코드 유지)
        const token = jwt.sign({ id: user.id, username: user.username }, "secretKey", { expiresIn: "1h" });

        // ✅ 원래대로 사용자 정보 반환
        res.json({ 
            message: "로그인 성공!", 
            token, 
            user: { id: user.id, username: user.username, email: user.email } 
        });
    });
});


//프로필 정보
app.get("/api/profile", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "인증 토큰 없음" });
    }

    try {
        const decoded = jwt.verify(token, "secretKey"); // JWT 토큰 검증
        db.query("SELECT username, email, profile_image, bio FROM users WHERE id = ?", 
        [decoded.id], (err, results) => {
            if (err || results.length === 0) {
                return res.status(404).json({ error: "사용자 정보 없음" });
            }
            res.json(results[0]);  // 사용자 정보 반환
        });
    } catch (error) {
        return res.status(401).json({ error: "유효하지 않은 토큰" });
    }
});

//프로필 업데이트
app.put("/api/profile", upload.single("profile_image"), (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "인증 토큰 없음" });
    }

    try {
        const decoded = jwt.verify(token, "secretKey");

        // `bio`는 `req.body`에서 가져오고, `profile_image`는 `req.file`에서 가져오기
        const { bio } = req.body;
        const profile_image = req.file ? `/uploads/${req.file.filename}` : null; // 업로드된 파일이 있을 경우

        db.query(
            "UPDATE users SET profile_image = COALESCE(?, profile_image), bio = COALESCE(?, bio) WHERE id = ?",
            [profile_image, bio, decoded.id], // `COALESCE(?, 기존값)`을 사용하여 NULL이면 기존 값 유지
            (err, result) => {
                if (err) {
                    console.error("❌ 프로필 업데이트 실패:", err);
                    return res.status(500).json({ error: "프로필 업데이트 실패" });
                }
                res.json({ message: "✅ 프로필 업데이트 성공!" });
            }
        );
    } catch (error) {
        return res.status(401).json({ error: "유효하지 않은 토큰" });
    }
});

//multer
// 업로드된 파일을 저장할 폴더 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/"); // 'uploads' 폴더에 저장
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // 파일명: timestamp + 확장자
    }
});
const upload = multer({ storage: storage });

// 정적 파일 제공 (업로드된 이미지를 프론트엔드에서 접근 가능하도록 함)
app.use("/uploads", express.static("uploads"));

// 프로필 사진 업로드 API
app.post("/api/upload", upload.single("profile"), (req, res) => {
    if (!req.file) {
        console.error("❌ 파일 업로드 실패: 파일이 없습니다.");
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
    }

    console.log("✅ 파일 업로드 성공:", req.file.filename);
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// 특정 사용자의 프로필 정보 가져오기 (자신 or 다른 사용자)
app.get("/api/profile/:id", (req, res) => {
    const userId = req.params.id; // 요청된 사용자 ID
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "인증 토큰 없음" });
    }

    try {
        jwt.verify(token, "secretKey"); // JWT 검증

        db.query("SELECT id, username, email, profile_image, bio FROM users WHERE id = ?", [userId], (err, results) => {
            if (err || results.length === 0) {
                return res.status(404).json({ error: "사용자 정보 없음" });
            }
            res.json(results[0]); // ✅ 특정 사용자의 프로필 정보 반환 가능
        });
    } catch (error) {
        return res.status(401).json({ error: "유효하지 않은 토큰" });
    }
});

//유저검증
app.get("/api/user", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "토큰이 없습니다. 로그인 후 다시 시도하세요." });
    }

    try {
        const decoded = jwt.verify(token, "secretKey"); // JWT 검증
        db.query("SELECT id, username, email FROM users WHERE id = ?", [decoded.id], (err, results) => {
            if (err || results.length === 0) {
                return res.status(404).json({ error: "사용자 정보를 찾을 수 없습니다." });
            }
            res.json(results[0]); // ✅ 로그인한 사용자 정보 반환
        });
    } catch (error) {
        return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
    }
});

// 게시물 작성 API (글쓰기 기능)
app.post("/api/posts", upload.single("image"), (req, res) => {
    const { user_id, title, content } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const sql = "INSERT INTO posts (user_id, title, content, image_url) VALUES (?, ?, ?, ?)";
    db.query(sql, [user_id, title, content, imageUrl], (err, result) => {
        if (err) {
            console.error("❌ 게시물 저장 실패:", err);
            return res.status(500).json({ error: "게시물 저장 실패" });
        }
        res.json({ message: "✅ 게시물 저장 성공!", postId: result.insertId });
    });
});

// ✅ 게시물 목록 가져오기 API 추가 (홈 버튼을 눌렀을 때 실행됨)
app.get("/api/posts", (req, res) => {
    db.query("SELECT * FROM posts ORDER BY created_at DESC", (err, results) => {
        if (err) {
            console.error("❌ 게시물 불러오기 실패:", err);
            return res.status(500).json({ error: "게시물 불러오기 실패" });
        }
        res.json(results);
    });
});

//댓글 작성
app.post("/api/comments", (req, res) => {
    const { post_id, user_id, content } = req.body;

    if (!post_id || !user_id || !content) {
        return res.status(400).json({ error: "모든 필드를 입력해야 합니다." });
    }

    const insertComment = "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)";
    db.query(insertComment, [post_id, user_id, content], (err, result) => {
        if (err) {
            console.error("❌ 댓글 저장 실패:", err);
            return res.status(500).json({ error: "댓글 저장 실패" });
        }

        // ✅ 게시물 작성자 찾기
        const findPostOwner = "SELECT user_id FROM posts WHERE id = ?";
        db.query(findPostOwner, [post_id], (err, postResult) => {
            if (err || postResult.length === 0) {
                return res.status(500).json({ error: "게시물 정보를 가져오지 못했습니다." });
            }

            const postOwnerId = postResult[0].user_id;
            if (postOwnerId !== user_id) {
                // ✅ 댓글 알림 저장
                const insertNotification = "INSERT INTO notifications (user_id, message) VALUES (?, ?)";
                const message = `새로운 댓글이 달렸습니다!`;
                db.query(insertNotification, [postOwnerId, message], (err) => {
                    if (err) console.error("❌ 알림 저장 실패:", err);
                });
            }
        });

        res.json({ message: "✅ 댓글 작성 성공!" });
    });
});


//댓글 불러오기
app.get("/api/comments/:post_id", (req, res) => {
    const { post_id } = req.params;

    const sql = "SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id WHERE post_id = ? ORDER BY created_at ASC";
    db.query(sql, [post_id], (err, results) => {
        if (err) {
            console.error("❌ 댓글 불러오기 실패:", err);
            return res.status(500).json({ error: "댓글 불러오기 실패" });
        }
        res.json(results);
    });
});

// 좋아요 버튼 클릭 시 알림 저장
app.post("/api/likes", (req, res) => {
    const { post_id, user_id } = req.body;

    if (!post_id || !user_id) {
        return res.status(400).json({ error: "필수 데이터가 누락되었습니다." });
    }

    // 이미 좋아요를 눌렀는지 확인
    const checkIfLiked = "SELECT * FROM likes WHERE post_id = ? AND user_id = ?";
    db.query(checkIfLiked, [post_id, user_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: "좋아요 상태 확인 실패" });
        }

        if (results.length > 0) {
            return res.status(400).json({ message: "이미 좋아요를 눌렀습니다." });
        }

        // 좋아요 추가
        const insertLike = "INSERT INTO likes (post_id, user_id) VALUES (?, ?)";
        db.query(insertLike, [post_id, user_id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: "좋아요 저장 실패" });
            }

            // 게시물 작성자에게 좋아요 알림 보내기
            const findPostOwner = "SELECT user_id FROM posts WHERE id = ?";
            db.query(findPostOwner, [post_id], (err, postResult) => {
                if (err || postResult.length === 0) {
                    return res.status(500).json({ error: "게시물 작성자 정보 조회 실패" });
                }

                const postOwnerId = postResult[0].user_id;
                if (postOwnerId !== user_id) {
                    // 좋아요 알림 저장 (type을 'like'로 설정)
                    const insertNotification = "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)";
                    const message = `새로운 좋아요가 달렸습니다!`;
                    db.query(insertNotification, [postOwnerId, message, 'like'], (err) => {
                        if (err) {
                            console.error("알림 저장 실패:", err);
                        }
                    });
                }
            });

            res.json({ message: "✅ 좋아요 추가 완료" });
        });
    });
});

//알림
app.get("/api/notifications/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = "SELECT * FROM notifications WHERE user_id = ? AND is_read = FALSE ORDER BY created_at DESC";
    db.query(sql, [user_id], (err, results) => {
        if (err) {
            console.error("❌ 알림 불러오기 실패:", err);
            return res.status(500).json({ error: "알림 불러오기 실패" });
        }
        res.json(results);
    });
});

// 알림 상태 업데이트 (읽음 처리)
app.put("/api/notifications/:id", (req, res) => {
    const { id } = req.params;  // 알림 ID

    const updateNotification = "UPDATE notifications SET is_read = TRUE WHERE id = ?";
    db.query(updateNotification, [id], (err, result) => {
        if (err) {
            console.error("❌ 알림 업데이트 실패:", err);
            return res.status(500).json({ error: "알림 업데이트 실패" });
        }
        res.json({ message: "✅ 알림 읽음 처리 완료!" });
    });
});

// ✅ 게시물의 좋아요 개수를 가져오는 API
app.get("/api/likes/count/:post_id", (req, res) => {
    const { post_id } = req.params;

    const countLikes = "SELECT COUNT(*) AS like_count FROM likes WHERE post_id = ?";
    db.query(countLikes, [post_id], (err, results) => {
        if (err) return res.status(500).json({ error: "좋아요 개수 불러오기 실패" });
        res.json(results[0]); // `{ like_count: 3 }` 형태로 응답
    });
});

// 게시물 저장 API
app.post("/api/saved_posts", (req, res) => {
    const { post_id, user_id } = req.body;

    if (!post_id || !user_id) {
        return res.status(400).json({ error: "게시물 ID와 사용자 ID가 필요합니다." });
    }

    // 게시물 이미 저장되었는지 확인
    const checkSaved = "SELECT * FROM saved_posts WHERE post_id = ? AND user_id = ?";
    db.query(checkSaved, [post_id, user_id], (err, results) => {
        if (err) return res.status(500).json({ error: "저장 상태 확인 실패" });

        if (results.length > 0) {
            return res.status(400).json({ message: "이미 저장된 게시물입니다." });
        }

        // 게시물 저장
        const savePost = "INSERT INTO saved_posts (post_id, user_id) VALUES (?, ?)";
        db.query(savePost, [post_id, user_id], (err, result) => {
            if (err) return res.status(500).json({ error: "게시물 저장 실패" });

            res.json({ message: "✅ 게시물 저장 완료" });
        });
    });
});

// 저장된 게시물 목록 불러오기
app.get("/api/saved_posts/:user_id", (req, res) => {
    const { user_id } = req.params;

    const getSavedPosts = `
        SELECT posts.* FROM posts
        JOIN saved_posts ON posts.id = saved_posts.post_id
        WHERE saved_posts.user_id = ?
    `;
    db.query(getSavedPosts, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: "저장된 게시물 불러오기 실패" });
        res.json(results);
    });
});
