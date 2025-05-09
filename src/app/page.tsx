"use client";

import { useState, useEffect, useRef } from "react";
import { GameScreen } from "../components/GameScreen";
import { Selector } from "../components/Selector";
import { Modal } from "../components/Modal";
import { generateNextQuestion, generateQuestions, handleInputChange, handleKeyDown } from "../utils/game";
import { RankingList } from "../components/Ranking";
import { RankingInputModalContent } from "../components/RankingModal";
import { formatTime } from "../utils/format";
import { calculateScore } from "../utils/score";
import { handleRankingRegistration } from "../utils/ranking";
import { startTimer, stopTimer, startTimerCountdown } from "../utils/stopWatch";

export default function Home() {
  const modes = [
    { name: "2進数から10進数", BinaryInput: false },
    { name: "10進数から2進数", BinaryInput: true },
    { name: "10進数から16進数", BinaryInput: false },
    { name: "16進数から2進数", BinaryInput: true },
    { name: "16進数から10進数", BinaryInput: false },
  ];
  const questionCounts = ["10問", "タイムアタック(1分)"];
  const difficultyLevels = [
    { id: "beginner", displayName: "初級", description: "1111まで" },
    { id: "intermediate", displayName: "中級", description: "1111 1111まで" },
    { id: "expert", displayName: "上級", description: "1111 1111 1111まで" }
  ];

  const [mode, setMode] = useState<string>(modes[0].name);
  const [questionCount, setQuestionCount] = useState<string>(questionCounts[0]);
  const [difficultyLevel, setDifficultyLevel] = useState<string>(difficultyLevels[0].id);
  const [gameStarted, setGameStarted] = useState(false);
  const [questions, setQuestions] = useState<{ question: string; answer: string }[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([""]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isNameInputModalOpen, setIsNameInputModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        const checkResponse = await fetch('/api/rankings/check');
        const checkData = await checkResponse.json();
        
        if (checkData.success && !checkData.tableExists) {
          const setupResponse = await fetch('/api/rankings/setup');
          const setupData = await setupResponse.json();
          console.log('DB初期化: ', setupData);
        }
      } catch (error) {
        console.error('DB初期化エラー:', error);
      }
    };
  
    setupDatabase();
  }, []);

  useEffect(() => {
    const savedMode = localStorage.getItem("selectedMode");
    const savedQuestionCount = localStorage.getItem("selectedQuestionCount");
    const savedDifficultyLevel = localStorage.getItem("selectedDifficultyLevel");
  
    if (savedMode) setMode(savedMode);
    if (savedQuestionCount) setQuestionCount(savedQuestionCount);
    if (savedDifficultyLevel) setDifficultyLevel(savedDifficultyLevel);
  }, []);

  const handleModeSelect = (item: { name: string }) => {
    setMode(item.name);
    localStorage.setItem("selectedMode", item.name);
  };

  const handleQuestionCountSelect = (count: string) => {
    setQuestionCount(count);
    localStorage.setItem("selectedQuestionCount", count);
  };

  const handleDifficultyLevelSelect = (level: { id: string }) => {
    setDifficultyLevel(level.id);
    localStorage.setItem("selectedDifficultyLevel", level.id);
  };

  const handleStart = () => {
    if (!mode || !questionCount || !difficultyLevel) {
      alert("モード、設問数、難易度を選択してください！");
      return;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedTime(questionCount === "タイムアタック(1分)" ? 60000 : 0);
    
    const newQuestions = generateQuestions(mode, questionCount, difficultyLevel);
    setQuestions(newQuestions);
    setGameStarted(true);
    setCurrentQuestionIndex(0);
    setScore(0);
    setMistakes(0);
    setFeedback(null);
    setUserAnswers([""]);
    
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      setCountdown(prevCount => {
        if (prevCount === null) return null;
        if (prevCount <= 1) {
          clearInterval(countdownInterval);
          if (questionCount === "10問" && !timerRef.current) {
            startTimer(setElapsedTime, timerRef);
          } else if (questionCount === "タイムアタック(1分)" && !timerRef.current) {
            startTimerCountdown(setElapsedTime, timerRef, handleTimeUp);
          }
          return null;
        }
        return prevCount - 1;
      });
    }, 1000);
  };

  const handleAnswerSubmit = () => {
    const userAnswer = userAnswers.join("").replace(/\s/g, "");
    
    let correctAnswer = questions[currentQuestionIndex].answer.replace(/\s/g, "");
    
    if (mode.includes("16進数") || (mode.includes("10進数から") && !mode.includes("2進数"))) {
      correctAnswer = correctAnswer.toUpperCase();
    }
  
    const normalizedUserAnswer = (mode.includes("16進数") || (mode.includes("10進数から") && !mode.includes("2進数"))) 
      ? userAnswer.toUpperCase() 
      : userAnswer;
    
      if (normalizedUserAnswer === correctAnswer) {
        setScore(score + 1);
        setFeedback("正解！");
      } else {
        if (questionCount === "タイムアタック(1分)") {
          setMistakes(mistakes + 1);
        }
        setFeedback(`不正解\n${questions[currentQuestionIndex].question}は${correctAnswer}でした！`);
      }
      setIsModalOpen(true);
    };
  
  const handleNextQuestion = () => {
    setFeedback(null);
    setUserAnswers([""]);
    setIsModalOpen(false);
    
    if (questionCount === "タイムアタック(1分)" && currentQuestionIndex + 1 >= questions.length) {
      const nextQuestion = generateNextQuestion(mode, difficultyLevel);
      setQuestions([...questions, nextQuestion]);
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      stopTimer(timerRef);
      setIsResultModalOpen(true);
    }
  };

  const handleTimeUp = () => {
    stopTimer(timerRef);
    setIsResultModalOpen(true);
  };

  const getCurrentScore = () => {
    if (questionCount === "タイムアタック(1分)") {
      const correctPoints = score * 100;
      const incorrectPoints = mistakes * -20; 
      
      let difficultyMultiplier = 1;
      if (difficultyLevel === difficultyLevels[1].id) difficultyMultiplier = 2;
      if (difficultyLevel === difficultyLevels[2].id) difficultyMultiplier = 3;
      
      return Math.max(0, (correctPoints + incorrectPoints) * difficultyMultiplier);
    } else {
      return calculateScore(
        score,
        questions.length,
        elapsedTime,
        difficultyLevel,
        difficultyLevels.map(level => level.id)
      );
    }
  };

  const registerToRanking = () => {
    setIsNameInputModalOpen(true);
  };

      playerName,
  const handleSaveToRanking = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const result = await handleRankingRegistration(
        playerName,
        getCurrentScore(),
        mode,
        difficultyLevel,
        elapsedTime,
        score,
        questionCount === "タイムアタック(1分)" ? currentQuestionIndex : questions.length,
        setIsNameInputModalOpen,
        setIsResultModalOpen,
        setGameStarted,
        setPlayerName
      );
      
      setIsSubmitting(false);
      
      if (result) {

      }
    } catch (error) {
      setIsSubmitting(false);
      console.error('ランキング登録エラー:', error);
    }
  };

  if (gameStarted) {
    const currentMode = modes.find((m) => m.name === mode);
    const progressPercentage = ((currentQuestionIndex + 1) / questions.length) * 100;
  
    return (
      <>
        {/* カウントダウン */}
        {countdown !== null && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="text-9xl font-bold text-blue-500">{countdown}</div>
          </div>
        )}
  
        {/* 進捗バー */}
        <div className="fixed top-0 left-0 w-full h-2 bg-gray-200">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ 
              width: questionCount === "タイムアタック(1分)" 
                ? `${(1 - elapsedTime / 60000) * 100}%` 
                : `${progressPercentage}%` 
            }}
          ></div>
        </div>

        {/* ストップウォッチ */}
        {(questionCount === "10問" || questionCount === "タイムアタック(1分)") && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded shadow-lg flex flex-col items-center">
            <p className="text-lg font-mono">{formatTime(elapsedTime)}</p>
          </div>
        )}
  
        {/* カウントダウン中は操作不可にするやつ */}
        <div className={countdown !== null ? "pointer-events-none opacity-50" : ""}>
          <GameScreen
            questions={questions}
            currentQuestionIndex={currentQuestionIndex}
            userAnswers={userAnswers}
            handleInputChange={(value, index) =>
              handleInputChange(value, index, userAnswers, setUserAnswers, inputRefs, currentMode?.BinaryInput || false)
            }
            handleKeyDown={(e, index) =>
              handleKeyDown(
                e, 
                index, 
                userAnswers, 
                setUserAnswers, 
                inputRefs, 
                currentMode?.BinaryInput || false,
              )
            }
            handleAnswerSubmit={handleAnswerSubmit}
            feedback={feedback}
            inputRefs={inputRefs}
            isBinaryInput={currentMode?.BinaryInput || false}
            mode={mode}
            countdown={countdown} 
            isTimeAttack={questionCount === "タイムアタック(1分)"}
          />
        </div>

        {/* 次へ行くやつ */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleNextQuestion}
          className={`p-6 rounded shadow-lg ${
            feedback?.startsWith("正解") ? "bg-green-200" : "bg-red-100"
          }`}
        >
          {feedback?.includes("\n") ? (
            <>
              <p className="text-lg font-bold">{feedback?.split("\n")[0]}</p>
              <p className="text-lg font-semibold mt-2">{feedback?.split("\n")[1]}</p>
            </>
          ) : (
            <p className="text-lg font-semibold">{feedback}</p>
          )}

          <p className="text-md mt-2">
            あなたの回答: {userAnswers.join("") || "未回答"}
          </p>
          <div className="flex justify-center mt-4">
            <button
              onClick={handleNextQuestion}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              次へ
            </button>
          </div>
        </Modal>

        {/* リザルト画面 */}
        <Modal
          isOpen={isResultModalOpen}
          onClose={() => setIsResultModalOpen(false)}
          className="p-6 rounded shadow-lg bg-blue-100"
        >
          <h2 className="text-xl font-bold">結果</h2>
          {questionCount === "タイムアタック(1分)" ? (
            <p className="text-lg mt-2">正誤: {score}/{currentQuestionIndex}</p>
          ) : (
            <p className="text-lg mt-2">正誤: {score}/{questions.length}</p>
          )}
          {questionCount === "タイムアタック(1分)" ? (
            <p className="text-lg mt-2">1問あたりの時間: {
              currentQuestionIndex > 0 
                ? `${(60 / currentQuestionIndex).toFixed(2)}秒` 
                : "計測不能"
            }</p>
          ) : (
            <p className="text-lg mt-2">かかった時間: {formatTime(elapsedTime)}</p>
          )}
          
          <p className="text-xl font-bold mt-6">スコア: {getCurrentScore()}</p>
          
          <div className="flex flex-col items-center gap-4 mt-8">
            <button
              onClick={registerToRanking}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full mt-4"
            >
              ランキングに登録する
            </button>
            
            <button
              onClick={() => {
                setIsResultModalOpen(false);
                setGameStarted(false);
              }}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-full"
            >
              閉じる
            </button>
          </div>
        </Modal>

        {/* ランキングの名前入力 */}
        <Modal
          isOpen={isNameInputModalOpen}
          onClose={() => {
            if (!isSubmitting) {
              setIsNameInputModalOpen(false);
            }
          }}
          className="p-6 rounded shadow-lg bg-white"
        >
          <RankingInputModalContent
            playerName={playerName}
            setPlayerName={setPlayerName}
            onSave={handleSaveToRanking}
            onCancel={() => {
              if (!isSubmitting) {
                setIsNameInputModalOpen(false);
              }
            }}
            isSubmitting={isSubmitting}
          />
        </Modal>
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-start justify-center gap-8 p-8 w-full max-w-7xl mx-auto">
      <div className="flex flex-col items-center gap-8 w-full md:w-1/2">
        <h1 className="text-2xl font-bold">基数変換の練習場</h1>
  
        <Selector
          title="ジャンルを選択"
          gridCols={2}
          items={modes}
          selectedItem={modes.find((m) => m.name === mode)!}
          onSelectItem={handleModeSelect}
          renderItem={(item) => item.name}
        />
        <Selector
          title="モードを選択"
          gridCols={2}
          items={questionCounts}
          selectedItem={questionCount}
          onSelectItem={handleQuestionCountSelect}
          renderItem={(count) => count}
        />
        <Selector
          title="難易度を選択"
          gridCols={3}
          items={difficultyLevels}
          selectedItem={difficultyLevels.find(level => level.id === difficultyLevel)!}
          onSelectItem={handleDifficultyLevelSelect}
          renderItem={(level, isSelected) => (
            <div className="text-center">
              <div className={`font-semibold ${isSelected ? 'text-white' : ''}`}>
                {level.displayName}
              </div>
              <div className={`text-xs ${isSelected ? 'text-gray-200' : 'text-gray-500'}`}>
                {level.description}
              </div>
            </div>
          )}
        />
  
        <button
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          onClick={handleStart}
        >
          開始
        </button>
      </div>
  
      <div className="w-full md:w-1/2 bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-center">ランキング</h2>
        <RankingList />
      </div>
    </div>
  );
}