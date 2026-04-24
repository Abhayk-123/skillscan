DEFAULT_LEADERBOARD = [
    {"name": "Aman", "rating": 1850, "solved": 320, "accepted": 430, "wrong": 60},
    {"name": "Riya", "rating": 1720, "solved": 285, "accepted": 390, "wrong": 75},
    {"name": "Kunal", "rating": 1600, "solved": 250, "accepted": 340, "wrong": 90},
    {"name": "Sneha", "rating": 1480, "solved": 210, "accepted": 290, "wrong": 70},
    {"name": "Rahul", "rating": 1320, "solved": 170, "accepted": 230, "wrong": 85},
    {"name": "Priya", "rating": 1210, "solved": 145, "accepted": 190, "wrong": 66},
    {"name": "Dev", "rating": 1100, "solved": 120, "accepted": 160, "wrong": 55},
]


def competitive_band(rating: int):
    rating = int(rating or 0)

    if rating >= 1800:
        return "Expert"
    if rating >= 1500:
        return "Advanced"
    if rating >= 1200:
        return "Intermediate"
    if rating >= 900:
        return "Beginner+"
    return "Beginner"


def calculate_rating(solved=0, accepted=0, wrong=0, streak=0):
    solved = int(solved or 0)
    accepted = int(accepted or 0)
    wrong = int(wrong or 0)
    streak = int(streak or 0)

    rating = 800
    rating += solved * 5
    rating += accepted * 2
    rating += streak * 10
    rating -= wrong * 1

    return max(300, rating)


def calc_user_rank(user_profile=None, leaderboard=None):
    if user_profile is None:
        user_profile = {}

    leaderboard = leaderboard or DEFAULT_LEADERBOARD

    name = user_profile.get("name") or "You"
    solved = int(user_profile.get("solved", 80))
    accepted = int(user_profile.get("accepted", solved))
    wrong = int(user_profile.get("wrong", 25))
    streak = int(user_profile.get("streak", 3))

    rating = int(user_profile.get("rating") or calculate_rating(solved, accepted, wrong, streak))

    user_row = {
        "name": name,
        "rating": rating,
        "solved": solved,
        "accepted": accepted,
        "wrong": wrong,
        "streak": streak,
        "band": competitive_band(rating),
        "is_you": True,
    }

    rows = []
    for item in leaderboard:
        row = dict(item)
        row["band"] = competitive_band(row.get("rating", 0))
        row["is_you"] = False
        rows.append(row)

    rows.append(user_row)
    rows = sorted(rows, key=lambda x: int(x.get("rating", 0)), reverse=True)

    for index, row in enumerate(rows, start=1):
        row["rank"] = index

    your_rank = next((row["rank"] for row in rows if row.get("is_you")), len(rows))
    total = len(rows)
    people_ahead = your_rank - 1
    people_behind = total - your_rank
    percentile = round((people_behind / max(total - 1, 1)) * 100)

    return {
        "user": user_row,
        "rank": your_rank,
        "total_users": total,
        "people_ahead": people_ahead,
        "people_behind": people_behind,
        "percentile": percentile,
        "leaderboard": rows,
        "recent_submissions": [
            {"problem": "Two Sum", "status": "Accepted", "difficulty": "Easy"},
            {"problem": "Binary Search", "status": "Accepted", "difficulty": "Easy"},
            {"problem": "Longest Substring", "status": "Wrong Answer", "difficulty": "Medium"},
            {"problem": "Merge Intervals", "status": "Accepted", "difficulty": "Medium"},
        ],
    }